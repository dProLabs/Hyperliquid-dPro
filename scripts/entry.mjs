import { parseInput } from './parser.mjs';
import { routeCommand, registerHandlers } from './router.mjs';
import { formatResult } from './format.mjs';
import { SkillError } from './errors.mjs';
import { setMasterPassword } from './store.mjs';

// Lazy-load command modules to avoid circular deps
let initialized = false;

async function ensureHandlers() {
  if (initialized) return;
  const [market, account, trade, onchain] = await Promise.all([
    import('./commands/market.mjs'),
    import('./commands/account.mjs'),
    import('./commands/trade.mjs'),
    import('./commands/onchain.mjs'),
  ]);
  registerHandlers({
    market: market.default || market,
    account: account.default || account,
    trade: trade.default || trade,
    onchain: onchain.default || onchain,
  });
  initialized = true;
}

export async function runHyperliquidSkill(rawInput, runtimeContext = {}) {
  try {
    await ensureHandlers();
    const parsed = parseInput(rawInput);
    // Support --password flag inline as well as runtimeContext.password
    const password = parsed.flags?.password || runtimeContext.password;
    if (password) {
      setMasterPassword(password);
      delete parsed.flags.password; // don't leak to command handlers
    }
    const outputMode = parsed.flags?.json ? 'json' : 'text';
    const result = await routeCommand(parsed, runtimeContext);
    return formatResult(result, outputMode);
  } catch (err) {
    if (err instanceof SkillError) {
      return formatResult(err);
    }
    return `Unexpected error: ${err.message}`;
  }
}
