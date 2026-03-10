import { parseInput } from './parser.mjs';
import { routeCommand, registerHandlers } from './router.mjs';
import { formatResult } from './format.mjs';
import { ErrorCode, SkillError } from './errors.mjs';
import { setMasterPassword } from './store.mjs';
import { maybeAutoUpgrade } from './auto-upgrade.mjs';
import { clearCachedPassword, loadCachedPassword, saveCachedPassword } from './password-cache.mjs';

// Lazy-load command modules to avoid circular deps
let initialized = false;
let maybeAutoUpgradeImpl = maybeAutoUpgrade;

export function __resolvePasswordForTest(parsed, runtimeContext = {}, env = process.env) {
  return (
    parsed?.flags?.password ||
    runtimeContext?.password ||
    env.DPRO_HL_MASTER_PASSWORD ||
    env.MASTER_PASSWORD ||
    loadCachedPassword(Date.now(), env) ||
    null
  );
}

export function __shouldClearPasswordCacheForTest(err) {
  if (!(err instanceof SkillError)) return false;
  if (err.code === ErrorCode.ENCRYPTION_ERROR) return true;
  const message = String(err.message || '').toLowerCase();
  return message.includes('wrong password') || message.includes('decryption failed') || message.includes('master password');
}

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
  const warnings = [];
  try {
    const upgrade = await maybeAutoUpgradeImpl(runtimeContext);
    if (upgrade?.warning) warnings.push(upgrade.warning);

    await ensureHandlers();
    const parsed = parseInput(rawInput);
    // Support --password flag inline, runtimeContext.password, and process env fallback.
    const explicitPassword = parsed?.flags?.password || null;
    const runtimePassword = runtimeContext?.password || null;
    const password = __resolvePasswordForTest(parsed, runtimeContext);
    if (password) {
      setMasterPassword(password);
      delete parsed.flags.password; // don't leak to command handlers
    }
    if (explicitPassword || runtimePassword) {
      saveCachedPassword(explicitPassword || runtimePassword);
    }
    const outputMode = parsed.flags?.json ? 'json' : 'text';
    const result = await routeCommand(parsed, runtimeContext);
    if (warnings.length && result && typeof result === 'object') {
      result.warnings = [...(result.warnings || []), ...warnings];
    }
    return formatResult(result, outputMode);
  } catch (err) {
    if (__shouldClearPasswordCacheForTest(err)) {
      clearCachedPassword();
    }
    if (err instanceof SkillError) {
      const formatted = formatResult(err);
      if (!warnings.length) return formatted;
      return `${formatted}\n\nWarnings:\n${warnings.map(w => `  ⚠ ${w}`).join('\n')}`;
    }
    let output = `Unexpected error: ${err.message}`;
    if (warnings.length) {
      output += `\n\nWarnings:\n${warnings.map(w => `  ⚠ ${w}`).join('\n')}`;
    }
    return output;
  }
}

export function __setAutoUpgradeForTest(fn) {
  maybeAutoUpgradeImpl = fn || maybeAutoUpgrade;
}
