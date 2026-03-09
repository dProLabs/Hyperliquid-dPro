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
const ACCOUNT_ACTIONS = new Set(['add-readonly', 'add-api', 'ls', 'remove', 'set-default', 'positions', 'balances', 'orders', 'fills', 'portfolio']);
const TRADE_ACTIONS = new Set(['limit', 'market', 'cancel', 'cancel-all', 'cancel-by-cloid', 'set-leverage', 'topup-isolated', 'modify']);
const ONCHAIN_ACTIONS = new Set(['ping', 'health', 'mids', 'spot-meta', 'perps-meta', 'spot-holders', 'spot-holder-counts', 'perp-holders', 'liquidation-map', 'leaderboard']);

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

  // Account actions: "account add-readonly 0x... alias"
  if (first === 'account') {
    const action = tokens[1]?.toLowerCase();
    if (!action || !ACCOUNT_ACTIONS.has(action)) {
      throw unknownCommand(`Unknown account action: ${action || '(none)'}. Available: ${[...ACCOUNT_ACTIONS].join(', ')}`);
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

  // Account shortcuts: "positions", "balances", "orders", "fills"
  if (['positions', 'balances', 'orders', 'fills', 'portfolio'].includes(first)) {
    return {
      domain: 'account',
      action: first,
      target: tokens[1] || null,
      args: { rest: tokens.slice(2) },
      flags,
      raw,
    };
  }

  // Trade actions: "order limit buy 0.01 BTC 50000", "order cancel <oid>"
  if (first === 'order') {
    const action = tokens[1]?.toLowerCase();
    if (!action || !TRADE_ACTIONS.has(action)) {
      throw unknownCommand(`Unknown order action: ${action || '(none)'}. Available: ${[...TRADE_ACTIONS].join(', ')}`);
    }

    if (action === 'limit' || action === 'market') {
      return parseOrderCommand(action, tokens.slice(2), flags, raw);
    }
    if (action === 'cancel') {
      return { domain: 'trade', action: 'cancel', target: tokens[2] || null, args: {}, flags, raw };
    }
    if (action === 'cancel-all') {
      return { domain: 'trade', action: 'cancel-all', target: null, args: {}, flags, raw };
    }
    if (action === 'cancel-by-cloid') {
      return { domain: 'trade', action: 'cancel-by-cloid', target: tokens[2]?.toUpperCase() || null, args: { cloid: tokens[3] }, flags, raw };
    }
    if (action === 'set-leverage') {
      return {
        domain: 'trade',
        action: 'set-leverage',
        target: tokens[2]?.toUpperCase() || null,
        args: { leverage: tokens[3] },
        flags,
        raw,
      };
    }
    if (action === 'topup-isolated') {
      return {
        domain: 'trade',
        action: 'topup-isolated',
        target: tokens[2]?.toUpperCase() || null,
        args: { usd: tokens[3] },
        flags,
        raw,
      };
    }

    return { domain: 'trade', action, target: tokens[2] || null, args: { rest: tokens.slice(3) }, flags, raw };
  }

  // Onchain actions: "onchain health", "onchain spot-holders PURR"
  if (first === 'onchain') {
    const action = tokens[1]?.toLowerCase();
    if (!action || !ONCHAIN_ACTIONS.has(action)) {
      throw unknownCommand(`Unknown onchain action: ${action || '(none)'}. Available: ${[...ONCHAIN_ACTIONS].join(', ')}`);
    }
    return {
      domain: 'onchain',
      action,
      target: tokens[2]?.toUpperCase() || null,
      args: { rest: tokens.slice(3) },
      flags,
      raw,
    };
  }

  throw unknownCommand(`Unknown command: ${first}. Try: quote, book, candles, movers, markets ls, onchain, account, order, positions, balances, orders, fills`);
}

function parseOrderCommand(action, tokens, flags, raw) {
  // limit: buy|sell <size> <coin> <price>
  // market: buy|sell <size> <coin>
  const side = tokens[0]?.toLowerCase();
  if (!side || !['buy', 'sell'].includes(side)) {
    throw inputError(`Order side must be "buy" or "sell", got: ${side || '(none)'}`);
  }

  const size = tokens[1];
  const coin = tokens[2]?.toUpperCase();

  if (!size || !coin) {
    throw inputError(`Usage: order ${action} ${side} <size> <coin>${action === 'limit' ? ' <price>' : ''}`);
  }

  const args = { side, size };

  if (action === 'limit') {
    const price = tokens[3];
    if (!price) throw inputError('Limit order requires a price');
    args.price = price;
  }

  return { domain: 'trade', action, target: coin, args, flags, raw };
}

// --- Natural language fallback ---

const NL_PATTERNS = [
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
      const target = targetGroup !== null ? m[targetGroup]?.toUpperCase() : null;
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
    return parseStructured(args, flags, raw);
  }

  // Try natural language
  const nlResult = parseNaturalLanguage(raw);
  if (nlResult) return nlResult;

  throw unknownCommand(`Could not parse input: "${raw}". Try "dpro-hl quote BTC" or "dpro-hl help".`);
}
