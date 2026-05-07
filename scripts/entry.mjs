import { parseInput } from './parser.mjs';
import { routeCommand, registerHandlers } from './router.mjs';
import { formatResult } from './format.mjs';
import { ErrorCode, SkillError } from './errors.mjs';
import { setApiWalletPassword, setMasterPassword } from './store.mjs';
import { maybeAutoUpgrade } from './auto-upgrade.mjs';
import {
  clearCachedPasswords,
  loadCachedApiPassword,
  loadCachedMasterPassword,
  saveCachedApiPassword,
  saveCachedMasterPassword,
} from './password-cache.mjs';

// Lazy-load command modules to avoid circular deps
let initialized = false;
let maybeAutoUpgradeImpl = maybeAutoUpgrade;

export function __resolveApiPasswordForTest(parsed, runtimeContext = {}, env = process.env) {
  return (
    parsed?.flags?.['api-password'] ||
    runtimeContext?.apiPassword ||
    env.DPRO_HL_API_PASSWORD ||
    loadCachedApiPassword(Date.now(), env) ||
    null
  );
}

export function __resolveMasterPasswordForTest(parsed, runtimeContext = {}, env = process.env) {
  return (
    parsed?.flags?.['master-password'] ||
    runtimeContext?.masterPassword ||
    env.DPRO_HL_MASTER_PASSWORD ||
    loadCachedMasterPassword(Date.now(), env) ||
    null
  );
}

export function __shouldClearPasswordCacheForTest(err) {
  if (!(err instanceof SkillError)) return false;
  if (err.code === ErrorCode.ENCRYPTION_ERROR) return true;
  const message = String(err.message || '').toLowerCase();
  return (
    message.includes('wrong password')
    || message.includes('decryption failed')
    || message.includes('master password')
    || message.includes('master wallet password')
    || message.includes('api password')
    || message.includes('api wallet password')
  );
}

async function ensureHandlers() {
  if (initialized) return;
  const [market, account, trade, transfer, onchain, news, asset] = await Promise.all([
    import('./commands/market.mjs'),
    import('./commands/account.mjs'),
    import('./commands/trade.mjs'),
    import('./commands/transfer.mjs'),
    import('./commands/onchain.mjs'),
    import('./commands/news.mjs'),
    import('./commands/asset.mjs'),
  ]);
  registerHandlers({
    market: market.default || market,
    account: account.default || account,
    trade: trade.default || trade,
    transfer: transfer.default || transfer,
    onchain: onchain.default || onchain,
    news: news.default || news,
    asset: asset.default || asset,
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
    const explicitApiPassword = parsed?.flags?.['api-password'] || null;
    const explicitMasterPassword = parsed?.flags?.['master-password'] || null;
    const runtimeApiPassword = runtimeContext?.apiPassword || null;
    const runtimeMasterPassword = runtimeContext?.masterPassword || null;
    const apiPassword = __resolveApiPasswordForTest(parsed, runtimeContext);
    const masterPassword = __resolveMasterPasswordForTest(parsed, runtimeContext);

    if (apiPassword) setApiWalletPassword(apiPassword);
    if (masterPassword) setMasterPassword(masterPassword);

    if (explicitApiPassword || runtimeApiPassword) {
      saveCachedApiPassword(explicitApiPassword || runtimeApiPassword);
    }
    if (explicitMasterPassword || runtimeMasterPassword) {
      saveCachedMasterPassword(explicitMasterPassword || runtimeMasterPassword);
    }

    delete parsed.flags['api-password'];
    delete parsed.flags['master-password'];

    const outputMode = parsed.flags?.json ? 'json' : 'text';
    const result = await routeCommand(parsed, runtimeContext);
    if (warnings.length && result && typeof result === 'object') {
      result.warnings = [...(result.warnings || []), ...warnings];
    }
    return formatResult(result, outputMode);
  } catch (err) {
    if (__shouldClearPasswordCacheForTest(err)) {
      clearCachedPasswords();
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
