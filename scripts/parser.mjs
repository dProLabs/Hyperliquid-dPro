import { inputError, unknownCommand } from './errors.mjs';

// --- Prefix stripping ---

function stripPrefix(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('/dpro-hl ') || trimmed.startsWith('/dpro-hl\t')) return trimmed.slice(9).trim();
  if (trimmed === '/dpro-hl') return '';
  if (trimmed.startsWith('dpro-hl ') || trimmed.startsWith('dpro-hl\t')) return trimmed.slice(8).trim();
  if (trimmed === 'dpro-hl') return '';
  return null; // no prefix found — try natural language
}

function hasLegacyPrefix(raw) {
  const trimmed = raw.trim();
  return (
    trimmed.startsWith('/hl ')
    || trimmed.startsWith('/hl\t')
    || trimmed === '/hl'
    || trimmed.startsWith('hl ')
    || trimmed.startsWith('hl\t')
    || trimmed === 'hl'
  );
}

// --- Tokenizer ---

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    // skip whitespace
    if (input[i] === ' ' || input[i] === '\t') { i++; continue; }

    // quoted string
    if (input[i] === '"' || input[i] === "'") {
      const quote = input[i];
      let j = i + 1;
      while (j < input.length && input[j] !== quote) j++;
      tokens.push(input.slice(i + 1, j));
      i = j + 1;
      continue;
    }

    // regular token
    let j = i;
    while (j < input.length && input[j] !== ' ' && input[j] !== '\t') j++;
    tokens.push(input.slice(i, j));
    i = j;
  }
  return tokens;
}

// --- Flag extraction ---

function extractFlags(tokens) {
  const args = [];
  const flags = {};
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      // check if next token is a value (not another flag)
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
        flags[key] = tokens[i + 1];
        i += 2;
      } else {
        flags[key] = true;
        i++;
      }
    } else {
      args.push(t);
      i++;
    }
  }
  return { args, flags };
}

// --- Command routing tables ---

const MARKET_ACTIONS = new Set(['quote', 'book', 'candles', 'movers', 'overview']);
const ACCOUNT_ACTIONS = new Set([
  'add-readonly', 'add-api', 'add-master', 'update-master', 'remove-master',
  'ls', 'remove', 'set-default', 'clear-password-cache',
  'positions', 'balances', 'orders', 'fills', 'portfolio',
  'order-history', 'funding-history', 'twap-history', 'twap-fill-history',
]);
const TRADE_ACTIONS = new Set([
  'limit', 'market', 'cancel', 'cancel-all', 'cancel-by-cloid',
  'set-leverage', 'topup-isolated', 'modify',
  'twap-create', 'twap-cancel', 'batch-limit', 'cancel-multiple',
  'close-position', 'reverse-position', 'scale-order', 'tpsl', 'oto',
]);
const TRADE_NAMESPACES = new Set(['spot', 'perp', 'hip3']);
const ONCHAIN_ACTIONS = new Set([
  'ping',
  'health',
  'mids',
  'spot-meta',
  'perps-meta',
  'address-tags',
  'spot-holders',
  'spot-holder-counts',
  'perp-holders',
  'liquidation-map',
  'liqmap',
  'liqmap-timeline',
  'orders-book',
  'orders-untriggered',
  'orders-chart',
  'trending',
  'leaderboard',
  'hip3-fills',
]);
const ONCHAIN_COIN_ACTIONS = new Set([
  'spot-holders',
  'perp-holders',
  'liquidation-map',
  'liqmap',
  'liqmap-timeline',
  'orders-book',
  'orders-untriggered',
  'orders-chart',
  'hip3-fills',
]);
const NEWS_ACTION_ALIASES = new Set(['list', 'ls']);
const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// --- Structured command parsing ---

function parseStructured(tokens, flags, raw) {
  if (tokens.length === 0) {
    return { domain: 'help', action: 'help', target: null, args: {}, flags, raw };
  }

  const first = tokens[0].toLowerCase();

  // "markets ls"
  if (first === 'markets' && tokens[1]?.toLowerCase() === 'ls') {
    return { domain: 'market', action: 'markets-ls', target: null, args: {}, flags, raw };
  }

  // "approve-builder"
  if (first === 'approve-builder') {
    return { domain: 'trade', action: 'approve-builder', target: null, args: {}, flags, raw };
  }

  // "builder-approval [alias|address] [--builder <address>]"
  if (first === 'builder-approval') {
    return { domain: 'trade', action: 'builder-approval', target: tokens[1] || null, args: {}, flags, raw };
  }

  // "transfer <usd> --to perp|spot"
  if (first === 'transfer') {
    const usd = tokens[1];
    if (!usd) {
      throw inputError('Usage: dpro-hl transfer <usd> [--to perp|spot]');
    }
    return { domain: 'transfer', action: 'transfer', target: null, args: { usd }, flags, raw };
  }

  // Market actions: "quote BTC", "book ETH", etc.
  if (MARKET_ACTIONS.has(first)) {
    return {
      domain: 'market',
      action: first,
      target: tokens[1]?.toUpperCase() || null,
      args: { rest: tokens.slice(2) },
      flags,
      raw,
    };
  }

  // News reads: "news [asset]", "news detail <id>".
  if (first === 'news') {
    const actionOrTarget = tokens[1]?.toLowerCase();
    if (actionOrTarget === 'detail') {
      if (!tokens[2]) throw inputError('Usage: dpro-hl news detail <id> [--asset <symbol>] [--locale <locale>]');
      return {
        domain: 'news',
        action: 'detail',
        target: tokens[2],
        args: { rest: tokens.slice(3) },
        flags,
        raw,
      };
    }

    if (NEWS_ACTION_ALIASES.has(actionOrTarget)) {
      return {
        domain: 'news',
        action: 'list',
        target: tokens[2] || null,
        args: { rest: tokens.slice(3) },
        flags,
        raw,
      };
    }

    return {
      domain: 'news',
      action: 'list',
      target: tokens[1] || null,
      args: { rest: tokens.slice(2) },
      flags,
      raw,
    };
  }

  // Account actions: "account add-readonly 0x... alias"
  if (first === 'account') {
    const action = tokens[1]?.toLowerCase();
    if (!action || !ACCOUNT_ACTIONS.has(action)) {
      throw unknownCommand(`Unknown account action: ${action || '(none)'}. Available: ${[...ACCOUNT_ACTIONS].join(', ')}`);
    }

    if (action === 'add-master' || action === 'update-master') {
      if (!tokens[2] || !ETH_ADDRESS_RE.test(tokens[2]) || !tokens[3]) {
        throw inputError(`Usage: dpro-hl account ${action} <masterAddress> <masterPrivKey>  --master-password <password>`);
      }
    }
    if (action === 'remove-master') {
      if (!tokens[2] || !ETH_ADDRESS_RE.test(tokens[2])) {
        throw inputError('Usage: dpro-hl account remove-master <masterAddress>  --master-password <password>');
      }
    }
    return {
      domain: 'account',
      action,
      target: tokens[2] || null,
      args: { rest: tokens.slice(3) },
      flags,
      raw,
    };
  }

  // Account shortcuts: "positions", "balances", "orders", "fills", etc.
  if (['positions', 'balances', 'orders', 'fills', 'portfolio', 'order-history', 'funding-history', 'twap-history', 'twap-fill-history'].includes(first)) {
    return {
      domain: 'account',
      action: first,
      target: tokens[1] || null,
      args: { rest: tokens.slice(2) },
      flags,
      raw,
    };
  }

  // Explicit trade namespaces: "spot|perp|hip3 order ..."
  if (TRADE_NAMESPACES.has(first)) {
    const marketType = first;
    if (tokens[1]?.toLowerCase() !== 'order') {
      throw inputError(`Usage: dpro-hl ${marketType} order <${[...TRADE_ACTIONS].join('|')}> ...`);
    }
    return parseTradeAction(marketType, tokens.slice(2), flags, raw);
  }

  // Legacy trade action is now disabled.
  if (first === 'order') {
    throw inputError('Legacy command "dpro-hl order ..." is no longer supported. Use "dpro-hl spot|perp|hip3 order ...".');
  }

  // Onchain actions: "onchain health", "onchain spot-holders PURR"
  if (first === 'onchain') {
    const action = tokens[1]?.toLowerCase();
    if (!action || !ONCHAIN_ACTIONS.has(action)) {
      throw unknownCommand(`Unknown onchain action: ${action || '(none)'}. Available: ${[...ONCHAIN_ACTIONS].join(', ')}`);
    }
    const target = ONCHAIN_COIN_ACTIONS.has(action)
      ? (tokens[2]?.toUpperCase() || null)
      : (tokens[2] || null);
    return {
      domain: 'onchain',
      action,
      target,
      args: { rest: tokens.slice(3) },
      flags,
      raw,
    };
  }

  throw unknownCommand(`Unknown command: ${first}. Try: quote, book, candles, movers, markets ls, news, transfer, onchain, account, spot order, perp order, hip3 order, approve-builder, builder-approval, positions, balances, orders, fills, order-history, funding-history, twap-history, twap-fill-history`);
}

function parseTradeAction(marketType, tokens, flags, raw) {
  const action = tokens[0]?.toLowerCase();
  if (!action || !TRADE_ACTIONS.has(action)) {
    throw unknownCommand(`Unknown order action: ${action || '(none)'}. Available: ${[...TRADE_ACTIONS].join(', ')}`);
  }

  if (action === 'limit' || action === 'market') {
    return parseOrderCommand(marketType, action, tokens.slice(1), flags, raw);
  }
  if (action === 'cancel') {
    return { domain: 'trade', marketType, action: 'cancel', target: tokens[1] || null, args: {}, flags, raw };
  }
  if (action === 'cancel-all') {
    return { domain: 'trade', marketType, action: 'cancel-all', target: null, args: {}, flags, raw };
  }
  if (action === 'cancel-by-cloid') {
    return { domain: 'trade', marketType, action: 'cancel-by-cloid', target: tokens[1]?.toUpperCase() || null, args: { cloid: tokens[2] }, flags, raw };
  }
  if (action === 'set-leverage') {
    return {
      domain: 'trade',
      marketType,
      action: 'set-leverage',
      target: tokens[1]?.toUpperCase() || null,
      args: { leverage: tokens[2] },
      flags,
      raw,
    };
  }
  if (action === 'topup-isolated') {
    return {
      domain: 'trade',
      marketType,
      action: 'topup-isolated',
      target: tokens[1]?.toUpperCase() || null,
      args: { usd: tokens[2] },
      flags,
      raw,
    };
  }
  if (action === 'modify') {
    return parseModifyCommand(marketType, tokens.slice(1), flags, raw);
  }
  if (action === 'twap-create') {
    return parseTwapCreateCommand(marketType, tokens.slice(1), flags, raw);
  }
  if (action === 'twap-cancel') {
    return parseTwapCancelCommand(marketType, tokens.slice(1), flags, raw);
  }
  if (action === 'batch-limit') {
    return parseBatchLimitCommand(marketType, tokens.slice(1), flags, raw);
  }
  if (action === 'cancel-multiple') {
    return parseCancelMultipleCommand(marketType, tokens.slice(1), flags, raw);
  }
  if (action === 'close-position') {
    return parseClosePositionCommand(marketType, tokens.slice(1), flags, raw);
  }
  if (action === 'reverse-position') {
    return parseReversePositionCommand(marketType, tokens.slice(1), flags, raw);
  }
  if (action === 'scale-order') {
    return parseScaleOrderCommand(marketType, tokens.slice(1), flags, raw);
  }
  if (action === 'tpsl') {
    return parseTpslCommand(marketType, tokens.slice(1), flags, raw);
  }
  if (action === 'oto') {
    return parseOtoCommand(marketType, tokens.slice(1), flags, raw);
  }

  return { domain: 'trade', marketType, action, target: tokens[1] || null, args: { rest: tokens.slice(2) }, flags, raw };
}

function parseModifyCommand(marketType, tokens, flags, raw) {
  // modify: <oid|cloid> buy|sell <size> <coin> <price>
  const oid = tokens[0];
  const side = tokens[1]?.toLowerCase();
  const size = tokens[2];
  const coin = tokens[3]?.toUpperCase();
  const price = tokens[4];

  if (!oid || !side || !size || !coin || !price) {
    throw inputError(`Usage: dpro-hl ${marketType} order modify <oid|cloid> buy|sell <size> <coin> <price>`);
  }
  if (!['buy', 'sell'].includes(side)) {
    throw inputError(`Order side must be "buy" or "sell", got: ${side}`);
  }

  return {
    domain: 'trade',
    marketType,
    action: 'modify',
    target: oid,
    args: { side, size, coin, price },
    flags,
    raw,
  };
}

function parseTwapCreateCommand(marketType, tokens, flags, raw) {
  // twap-create: buy|sell <size> <coin> --minutes <N>
  const side = tokens[0]?.toLowerCase();
  const size = tokens[1];
  const coin = tokens[2]?.toUpperCase();
  if (!side || !['buy', 'sell'].includes(side) || !size || !coin) {
    throw inputError(`Usage: dpro-hl ${marketType} order twap-create buy|sell <size> <coin> --minutes <N>`);
  }

  return {
    domain: 'trade',
    marketType,
    action: 'twap-create',
    target: coin,
    args: { side, size },
    flags,
    raw,
  };
}

function parseTwapCancelCommand(marketType, tokens, flags, raw) {
  // twap-cancel: <coin> <twapId>
  const coin = tokens[0]?.toUpperCase();
  const twapId = tokens[1];
  if (!coin || !twapId) {
    throw inputError(`Usage: dpro-hl ${marketType} order twap-cancel <coin> <twapId>`);
  }

  return {
    domain: 'trade',
    marketType,
    action: 'twap-cancel',
    target: coin,
    args: { twapId },
    flags,
    raw,
  };
}

function parseBatchLimitCommand(marketType, tokens, flags, raw) {
  // batch-limit: buy|sell <coin> <size@price,size@price,...>
  const side = tokens[0]?.toLowerCase();
  const coin = tokens[1]?.toUpperCase();
  const entries = tokens[2];
  if (!side || !['buy', 'sell'].includes(side) || !coin || !entries) {
    throw inputError(`Usage: dpro-hl ${marketType} order batch-limit buy|sell <coin> <size@price,size@price,...>`);
  }

  return {
    domain: 'trade',
    marketType,
    action: 'batch-limit',
    target: coin,
    args: { side, entries },
    flags,
    raw,
  };
}

function parseCancelMultipleCommand(marketType, tokens, flags, raw) {
  // cancel-multiple: <oid1,oid2,...>
  const oids = tokens[0];
  if (!oids) {
    throw inputError(`Usage: dpro-hl ${marketType} order cancel-multiple <oid1,oid2,...>`);
  }

  return {
    domain: 'trade',
    marketType,
    action: 'cancel-multiple',
    target: null,
    args: { oids },
    flags,
    raw,
  };
}

function parseClosePositionCommand(marketType, tokens, flags, raw) {
  const coin = tokens[0]?.toUpperCase();
  if (!coin) {
    throw inputError(`Usage: dpro-hl ${marketType} order close-position <coin> [--size <N>] [--limit-price <P>|--slippage <N>]`);
  }
  return {
    domain: 'trade',
    marketType,
    action: 'close-position',
    target: coin,
    args: {},
    flags,
    raw,
  };
}

function parseReversePositionCommand(marketType, tokens, flags, raw) {
  const coin = tokens[0]?.toUpperCase();
  if (!coin) {
    throw inputError(`Usage: dpro-hl ${marketType} order reverse-position <coin> [--size <N>] [--slippage <N>]`);
  }
  return {
    domain: 'trade',
    marketType,
    action: 'reverse-position',
    target: coin,
    args: {},
    flags,
    raw,
  };
}

function parseScaleOrderCommand(marketType, tokens, flags, raw) {
  const side = tokens[0]?.toLowerCase();
  const coin = tokens[1]?.toUpperCase();
  if (!side || !['buy', 'sell'].includes(side) || !coin) {
    throw inputError(`Usage: dpro-hl ${marketType} order scale-order buy|sell <coin> --from <P> --to <P> --count <N> --total-size <N>`);
  }
  return {
    domain: 'trade',
    marketType,
    action: 'scale-order',
    target: coin,
    args: { side },
    flags,
    raw,
  };
}

function parseTpslCommand(marketType, tokens, flags, raw) {
  const coin = tokens[0]?.toUpperCase();
  if (!coin) {
    throw inputError(`Usage: dpro-hl ${marketType} order tpsl <coin> --tp <price> --sl <price> [--size <N>]`);
  }
  return {
    domain: 'trade',
    marketType,
    action: 'tpsl',
    target: coin,
    args: {},
    flags,
    raw,
  };
}

function parseOtoCommand(marketType, tokens, flags, raw) {
  const side = tokens[0]?.toLowerCase();
  const size = tokens[1];
  const coin = tokens[2]?.toUpperCase();
  const entryPrice = tokens[3];
  if (!side || !['buy', 'sell'].includes(side) || !size || !coin || !entryPrice) {
    throw inputError(`Usage: dpro-hl ${marketType} order oto buy|sell <size> <coin> <entryPrice> --tp <price> --sl <price>`);
  }
  return {
    domain: 'trade',
    marketType,
    action: 'oto',
    target: coin,
    args: { side, size, entryPrice },
    flags,
    raw,
  };
}

function parseOrderCommand(marketType, action, tokens, flags, raw) {
  // limit: buy|sell <size> <coin> <price>
  // market: buy|sell <size> <coin>
  const side = tokens[0]?.toLowerCase();
  if (!side || !['buy', 'sell'].includes(side)) {
    throw inputError(`Order side must be "buy" or "sell", got: ${side || '(none)'}`);
  }

  const size = tokens[1];
  const coin = tokens[2]?.toUpperCase();

  if (!size || !coin) {
    throw inputError(`Usage: dpro-hl ${marketType} order ${action} ${side} <size> <coin>${action === 'limit' ? ' <price>' : ''}`);
  }

  const args = { side, size };

  if (action === 'limit') {
    const price = tokens[3];
    if (!price) throw inputError('Limit order requires a price');
    args.price = price;
  }

  return { domain: 'trade', marketType, action, target: coin, args, flags, raw };
}

// --- Natural language fallback ---

const NL_PATTERNS = [
  { pattern: /(?:news|\u65b0\u95fb)(?:\s+(?:for|about))?\s+([A-Za-z0-9:@/.-]+)/i, domain: 'news', action: 'list', targetGroup: 1 },
  { pattern: /([A-Za-z0-9:@/.-]+)\s*(?:news|\u65b0\u95fb)/i, domain: 'news', action: 'list', targetGroup: 1 },
  { pattern: /(?:\u62a5\u4ef7|\u4ef7\u683c|price|quote)\s*([A-Za-z0-9:]+)/i, domain: 'market', action: 'quote', targetGroup: 1 },
  { pattern: /([A-Za-z0-9:]+)\s*(?:\u62a5\u4ef7|\u4ef7\u683c|price|quote)/i, domain: 'market', action: 'quote', targetGroup: 1 },
  { pattern: /(?:\u76d8\u53e3|book|\u6df1\u5ea6|depth)\s*([A-Za-z0-9:]+)/i, domain: 'market', action: 'book', targetGroup: 1 },
  { pattern: /([A-Za-z0-9:]+)\s*(?:\u76d8\u53e3|book|\u6df1\u5ea6|depth)/i, domain: 'market', action: 'book', targetGroup: 1 },
  { pattern: /(?:K\u7ebf|candles?|kline)\s*([A-Za-z0-9:]+)/i, domain: 'market', action: 'candles', targetGroup: 1 },
  { pattern: /([A-Za-z0-9:]+)\s*(?:\d+[hmd]\s*)?(?:K\u7ebf|candles?|kline)/i, domain: 'market', action: 'candles', targetGroup: 1 },
  { pattern: /(?:\u6301\u4ed3|positions?)/i, domain: 'account', action: 'positions', targetGroup: null },
  { pattern: /(?:\u4f59\u989d|balances?)/i, domain: 'account', action: 'balances', targetGroup: null },
  { pattern: /(?:\u8ba2\u5355|orders?)/i, domain: 'account', action: 'orders', targetGroup: null },
  { pattern: /(?:\u6210\u4ea4|fills?)/i, domain: 'account', action: 'fills', targetGroup: null },
  { pattern: /(?:\u6da8\u5e45|movers?|gainers?|losers?)/i, domain: 'market', action: 'movers', targetGroup: null },
  { pattern: /(?:\u6982\u89c8|overview)/i, domain: 'market', action: 'overview', targetGroup: null },
  { pattern: /(?:\u5e02\u573a|markets?)\s*(?:\u5217\u8868|list|ls)/i, domain: 'market', action: 'markets-ls', targetGroup: null },
  // Trading NL
  { pattern: /(?:\u4e70\u5165?|buy|long)\s+([\d.]+)\s*([A-Za-z0-9:]+)/i, domain: 'trade', action: 'market', targetGroup: 2, extractArgs: (m) => ({ side: 'buy', size: m[1] }) },
  { pattern: /(?:\u5356\u51fa?|sell|short)\s+([\d.]+)\s*([A-Za-z0-9:]+)/i, domain: 'trade', action: 'market', targetGroup: 2, extractArgs: (m) => ({ side: 'sell', size: m[1] }) },
];

// Extract interval/last from natural language like "1h K-line last 48"
function extractCandleParams(raw) {
  const flags = {};
  const ivMatch = raw.match(/(\d+[mhdwM])\s*(?:K\u7ebf|candle|kline)/i);
  if (ivMatch) flags.interval = ivMatch[1];
  const lastMatch = raw.match(/(?:\u6700\u8fd1|last)\s*(\d+)/i);
  if (lastMatch) flags.last = lastMatch[1];
  return flags;
}

function parseNaturalLanguage(raw) {
  for (const { pattern, domain, action, targetGroup, extractArgs } of NL_PATTERNS) {
    const m = raw.match(pattern);
    if (m) {
      if (domain === 'trade') {
        throw inputError('Trading commands must specify a market namespace. Use "dpro-hl spot|perp|hip3 order ...".');
      }
      const matchedTarget = targetGroup !== null ? m[targetGroup] : null;
      const target = targetGroup !== null
        ? (domain === 'news' ? matchedTarget : matchedTarget?.toUpperCase())
        : null;
      const args = extractArgs ? extractArgs(m) : {};
      const flags = action === 'candles' ? extractCandleParams(raw) : {};
      return { domain, action, target, args, flags, raw };
    }
  }
  return null;
}

// --- Public API ---

export function parseInput(rawInput) {
  const raw = rawInput.trim();
  if (!raw) throw inputError('Empty input');

  if (hasLegacyPrefix(raw)) {
    throw unknownCommand(`Could not parse input: "${raw}". Use "dpro-hl ..." instead.`);
  }

  // Try prefix-based parsing
  const stripped = stripPrefix(raw);
  if (stripped !== null) {
    const tokens = tokenize(stripped);
    const { args, flags } = extractFlags(tokens);
    if (Object.prototype.hasOwnProperty.call(flags, 'password')) {
      throw inputError('Legacy password flag is no longer supported. Use `--api-password` or `--master-password`.');
    }
    return parseStructured(args, flags, raw);
  }

  // Try natural language
  const nlResult = parseNaturalLanguage(raw);
  if (nlResult) return nlResult;

  throw unknownCommand(`Could not parse input: "${raw}". Try "dpro-hl quote BTC" or "dpro-hl help".`);
}
