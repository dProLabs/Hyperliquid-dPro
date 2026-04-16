import * as store from '../store.mjs';
import * as infoClient from '../clients/info-client.mjs';
import { resolveQueryAddress } from '../resolvers/account-resolver.mjs';
import { findMarket } from '../resolvers/market-resolver.mjs';
import { assertAddress, assertPrivateKey } from '../utils/validate.mjs';
import { inputError } from '../errors.mjs';
import { DEFAULT_FILL_LIMIT } from '../constants.mjs';
import { clearCachedPasswords } from '../password-cache.mjs';

const defaultDeps = {
  store,
  infoClient,
  resolveQueryAddress,
  findMarket,
  assertAddress,
  assertPrivateKey,
  inputError,
};

const deps = { ...defaultDeps };

// Derive agent address from private key
async function deriveAddress(privateKeyHex) {
  const { secp256k1 } = await import('@noble/curves/secp256k1');
  const { keccak_256 } = await import('@noble/hashes/sha3');
  const keyBytes = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
  const pubKey = secp256k1.getPublicKey(keyBytes, false).slice(1); // uncompressed, strip 04 prefix
  const hash = keccak_256(pubKey);
  return '0x' + Buffer.from(hash).slice(-20).toString('hex');
}

function inferPerpDex(meta, dexIndex) {
  if (dexIndex === 0) return '';
  const firstName = meta?.universe?.[0]?.name || '';
  if (!firstName) return '';
  return firstName.includes(':') ? firstName.split(':')[0] : firstName;
}

async function loadPerpStates(address, netOpts) {
  try {
    const metas = await deps.infoClient.getAllPerpMetas(netOpts);
    if (!Array.isArray(metas) || !metas.length) {
      return [await deps.infoClient.getClearinghouseState(address, netOpts)];
    }
    const states = await Promise.all(
      metas.map((meta, dexIndex) => deps.infoClient.getClearinghouseState(
        address,
        { ...netOpts, dex: inferPerpDex(meta, dexIndex) },
      )),
    );
    return states.filter(Boolean);
  } catch {
    // Fallback to legacy single-dex behavior if dex discovery fails.
    return [await deps.infoClient.getClearinghouseState(address, netOpts)];
  }
}

function makeCoinDisplayResolver(isTestnet) {
  const cache = new Map();
  return async (coin) => {
    if (!coin) return coin;
    if (!String(coin).startsWith('@')) return coin;
    if (cache.has(coin)) return cache.get(coin);
    try {
      const market = await deps.findMarket(coin, { isTestnet });
      const resolved = market?.coin || coin;
      cache.set(coin, resolved);
      return resolved;
    } catch {
      cache.set(coin, coin);
      return coin;
    }
  };
}

async function addReadonly(parsed) {
  const address = parsed.target;
  if (!address) throw deps.inputError('Usage: dpro-hl account add-readonly <address> [alias]');
  deps.assertAddress(address, 'master address');

  const alias = parsed.args?.rest?.[0] || address.slice(0, 8);
  const account = deps.store.addReadonlyAccount(address, alias);

  return { ok: true, type: 'account-added', data: { alias: account.alias, masterAddress: account.masterAddress, mode: 'readonly' } };
}

async function addApi(parsed, ctx) {
  const masterAddress = parsed.target;
  const agentPrivateKey = parsed.args?.rest?.[0];
  const alias = parsed.args?.rest?.[1];

  if (!masterAddress || !agentPrivateKey) {
    throw deps.inputError('Usage: dpro-hl account add-api <masterAddress> <agentPrivateKey> [alias]  --api-password <password>');
  }

  deps.assertAddress(masterAddress, 'master address');
  const cleanKey = deps.assertPrivateKey(agentPrivateKey);

  // Set API wallet password from context if provided
  if (ctx?.apiPassword) deps.store.setApiWalletPassword(ctx.apiPassword);
  if (!deps.store.getApiWalletPassword()) {
    throw deps.inputError('API wallet password required. Pass via runtimeContext.apiPassword or set it first.');
  }

  const agentAddress = await deriveAddress(cleanKey);
  const accountAlias = alias || masterAddress.slice(0, 8);

  const account = deps.store.addApiAccount(masterAddress, agentAddress, cleanKey, accountAlias);

  return {
    ok: true,
    type: 'account-added',
    data: { alias: account.alias, masterAddress: account.masterAddress, agentAddress, mode: 'api' },
  };
}

function ensurePassword(ctx) {
  if (ctx?.masterPassword) deps.store.setMasterPassword(ctx.masterPassword);
  if (!deps.store.getMasterPassword()) {
    throw deps.inputError('Master wallet password required. Pass via runtimeContext.masterPassword or set it first.');
  }
}

async function addMaster(parsed, ctx) {
  const masterAddress = parsed.target;
  const masterPrivateKey = parsed.args?.rest?.[0];
  if (!masterAddress || !masterPrivateKey) {
    throw deps.inputError('Usage: dpro-hl account add-master <masterAddress> <masterPrivKey>  --master-password <password>');
  }
  deps.assertAddress(masterAddress, 'master address');
  const cleanKey = deps.assertPrivateKey(masterPrivateKey);
  ensurePassword(ctx);
  deps.store.addMasterPrivateKeyByAddress(masterAddress, cleanKey);
  return { ok: true, type: 'master-key-added', data: { masterAddress } };
}

async function updateMaster(parsed, ctx) {
  const masterAddress = parsed.target;
  const masterPrivateKey = parsed.args?.rest?.[0];
  if (!masterAddress || !masterPrivateKey) {
    throw deps.inputError('Usage: dpro-hl account update-master <masterAddress> <masterPrivKey>  --master-password <password>');
  }
  deps.assertAddress(masterAddress, 'master address');
  const cleanKey = deps.assertPrivateKey(masterPrivateKey);
  ensurePassword(ctx);
  deps.store.updateMasterPrivateKeyByAddress(masterAddress, cleanKey);
  return { ok: true, type: 'master-key-updated', data: { masterAddress } };
}

async function removeMaster(parsed, ctx) {
  const masterAddress = parsed.target;
  if (!masterAddress) {
    throw deps.inputError('Usage: dpro-hl account remove-master <masterAddress>  --master-password <password>');
  }
  deps.assertAddress(masterAddress, 'master address');
  ensurePassword(ctx);
  deps.store.removeMasterPrivateKeyByAddress(masterAddress);
  return { ok: true, type: 'master-key-removed', data: { masterAddress } };
}

async function ls() {
  const accounts = deps.store.listAccounts().map((a) => ({
    ...a,
    agentAddress: a.agentAddress || null,
    hasAgentKey: typeof a.hasAgentKey === 'boolean' ? a.hasAgentKey : a.mode === 'api',
    hasMasterKey: deps.store.hasMasterPrivateKeyByAddress(a.masterAddress),
  }));
  return { ok: true, type: 'account-ls', data: { accounts } };
}

async function remove(parsed) {
  const alias = parsed.target;
  if (!alias) throw deps.inputError('Usage: dpro-hl account remove <alias>');
  deps.store.removeAccount(alias);
  return { ok: true, type: 'account-removed', data: { alias } };
}

async function setDefault(parsed) {
  const alias = parsed.target;
  if (!alias) throw deps.inputError('Usage: dpro-hl account set-default <alias>');
  deps.store.setDefaultAccount(alias);
  return { ok: true, type: 'account-default-set', data: { alias } };
}

async function clearPasswordCache() {
  clearCachedPasswords();
  return { ok: true, type: 'password-cache-cleared', data: { cleared: true } };
}

async function positions(parsed, ctx) {
  const address = deps.resolveQueryAddress(parsed.target);
  const isTestnet = ctx?.network === 'testnet';
  const netOpts = { isTestnet };
  const [perpStates] = await Promise.all([
    loadPerpStates(address, netOpts),
    deps.infoClient.getSpotClearinghouseState(address, netOpts),
  ]);

  const positions = [];

  // Aggregate positions from all perp dexes (main + HIP-3/perp namespaces).
  for (const perpState of (perpStates || [])) {
    if (!perpState?.assetPositions) continue;
    for (const ap of perpState.assetPositions) {
      const pos = ap.position;
      if (Number(pos.szi) === 0) continue;
      const szi = Number(pos.szi);
      positions.push({
        coin: pos.coin,
        side: szi > 0 ? 'Long' : 'Short',
        size: Math.abs(szi),
        entryPx: pos.entryPx,
        markPx: pos.positionValue ? Math.abs(Number(pos.positionValue) / szi) : null,
        unrealizedPnl: pos.unrealizedPnl,
        leverage: pos.leverage?.value || null,
        type: 'perp',
      });
    }
  }

  return { ok: true, type: 'positions', data: { positions } };
}

async function balances(parsed, ctx) {
  const address = deps.resolveQueryAddress(parsed.target);
  const isTestnet = ctx?.network === 'testnet';
  const netOpts = { isTestnet };
  const [perpState, spotState] = await Promise.all([
    deps.infoClient.getClearinghouseState(address, netOpts),
    deps.infoClient.getSpotClearinghouseState(address, netOpts),
  ]);

  const data = {};

  if (perpState) {
    data.perpEquity = perpState.marginSummary?.accountValue;
    data.availableBalance = perpState.withdrawable;
  }

  if (spotState?.balances) {
    data.spotBalances = spotState.balances
      .filter(b => Number(b.total) > 0)
      .map(b => ({
        coin: b.coin,
        total: b.total,
        hold: b.hold,
      }));
  }

  return { ok: true, type: 'balances', data };
}

async function orders(parsed, ctx) {
  const address = deps.resolveQueryAddress(parsed.target);
  const isTestnet = ctx?.network === 'testnet';
  const result = await deps.infoClient.getOpenOrders(address, { isTestnet, dex: 'ALL_DEXS' });
  const toDisplayCoin = makeCoinDisplayResolver(isTestnet);

  const orderList = await Promise.all((result || []).map(async (o) => ({
    oid: o.oid,
    coin: await toDisplayCoin(o.coin),
    side: o.side === 'B' ? 'Buy' : 'Sell',
    sz: o.sz,
    limitPx: o.limitPx,
    orderType: o.orderType,
  })));

  return { ok: true, type: 'orders', data: { orders: orderList } };
}

async function fills(parsed, ctx) {
  const address = deps.resolveQueryAddress(parsed.target);
  const limit = Number(parsed.flags?.limit) || DEFAULT_FILL_LIMIT;
  const isTestnet = ctx?.network === 'testnet';

  const result = await deps.infoClient.getUserFills(address, true, { isTestnet });
  const toDisplayCoin = makeCoinDisplayResolver(isTestnet);
  const fillList = await Promise.all((result || []).slice(0, limit).map(async (f) => ({
    time: f.time,
    coin: await toDisplayCoin(f.coin),
    side: f.side === 'B' ? 'Buy' : 'Sell',
    sz: f.sz,
    px: f.px,
    fee: f.fee,
    oid: f.oid,
  })));

  return { ok: true, type: 'fills', data: { fills: fillList } };
}

function parseOptionalMsTimestamp(value, label) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw deps.inputError(`${label} must be a Unix ms timestamp, got: "${value}".`);
  }
  return Math.floor(n);
}

function normalizeEpochMs(value) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Some APIs return seconds; normalize to milliseconds for display consistency.
  return n < 1e12 ? Math.floor(n * 1000) : Math.floor(n);
}

async function orderHistory(parsed, ctx) {
  const address = deps.resolveQueryAddress(parsed.target);
  const limit = Number(parsed.flags?.limit) || DEFAULT_FILL_LIMIT;
  const isTestnet = ctx?.network === 'testnet';

  const result = await deps.infoClient.getHistoricalOrders(address, { isTestnet });
  const toDisplayCoin = makeCoinDisplayResolver(isTestnet);
  const rows = await Promise.all((result || []).slice(0, limit).map(async (row) => ({
    time: row.statusTimestamp || row.order?.timestamp || null,
    coin: await toDisplayCoin(row.order?.coin || ''),
    side: row.order?.side === 'B' ? 'Buy' : 'Sell',
    sz: row.order?.sz || row.order?.origSz || null,
    px: row.order?.limitPx || row.order?.px || null,
    status: row.status || 'unknown',
    oid: row.order?.oid || null,
  })));

  return { ok: true, type: 'order-history', data: { orders: rows } };
}

async function fundingHistory(parsed, ctx) {
  const address = deps.resolveQueryAddress(parsed.target);
  const limit = Number(parsed.flags?.limit) || DEFAULT_FILL_LIMIT;
  const isTestnet = ctx?.network === 'testnet';
  const startTime = parseOptionalMsTimestamp(parsed.flags?.['start-time'], 'start-time');
  const endTime = parseOptionalMsTimestamp(parsed.flags?.['end-time'], 'end-time');

  const result = await deps.infoClient.getUserFunding(address, startTime, endTime, { isTestnet });
  const rows = (result || []).slice(0, limit).map((row) => ({
    time: row.time,
    hash: row.hash,
    coin: row.delta?.coin || '—',
    usdc: row.delta?.usdc || '0',
    szi: row.delta?.szi || '0',
    fundingRate: row.delta?.fundingRate || '0',
  }));

  return { ok: true, type: 'funding-history', data: { items: rows } };
}

async function twapHistory(parsed, ctx) {
  const address = deps.resolveQueryAddress(parsed.target);
  const limit = Number(parsed.flags?.limit) || DEFAULT_FILL_LIMIT;
  const isTestnet = ctx?.network === 'testnet';

  const result = await deps.infoClient.getTwapHistory(address, { isTestnet });
  const toDisplayCoin = makeCoinDisplayResolver(isTestnet);
  const rows = await Promise.all((result || []).slice(0, limit).map(async (row) => ({
    time: normalizeEpochMs(row.time || row.state?.timestamp),
    twapId: row.twapId ?? null,
    coin: await toDisplayCoin(row.state?.coin || ''),
    side: row.state?.side === 'B' ? 'Buy' : (row.state?.side === 'A' ? 'Sell' : '—'),
    sz: row.state?.sz || null,
    executedSz: row.state?.executedSz || null,
    executedNtl: row.state?.executedNtl || null,
    minutes: row.state?.minutes || null,
    randomize: !!row.state?.randomize,
    reduceOnly: !!row.state?.reduceOnly,
    status: row.status?.status || 'unknown',
    error: row.status?.status === 'error' ? row.status?.description || null : null,
  })));

  return { ok: true, type: 'twap-history', data: { items: rows } };
}

async function twapFillHistory(parsed, ctx) {
  const address = deps.resolveQueryAddress(parsed.target);
  const limit = Number(parsed.flags?.limit) || DEFAULT_FILL_LIMIT;
  const isTestnet = ctx?.network === 'testnet';

  const result = await deps.infoClient.getUserTwapSliceFills(address, { isTestnet });
  const toDisplayCoin = makeCoinDisplayResolver(isTestnet);
  const rows = await Promise.all((result || []).slice(0, limit).map(async (row) => ({
    time: normalizeEpochMs(row.fill?.time),
    twapId: row.twapId,
    coin: await toDisplayCoin(row.fill?.coin || ''),
    side: row.fill?.side === 'B' ? 'Buy' : (row.fill?.side === 'A' ? 'Sell' : '—'),
    sz: row.fill?.sz || null,
    px: row.fill?.px || null,
    fee: row.fill?.fee || null,
    oid: row.fill?.oid || null,
  })));

  return { ok: true, type: 'twap-fill-history', data: { fills: rows } };
}

async function portfolio(parsed, ctx) {
  const [posResult, balResult, ordResult] = await Promise.all([
    positions(parsed, ctx),
    balances(parsed, ctx),
    orders(parsed, ctx),
  ]);

  // Combine into a portfolio view — reuse the balances format with extras
  const data = {
    ...balResult.data,
    positions: posResult.data.positions,
    openOrderCount: ordResult.data.orders.length,
  };

  return { ok: true, type: 'balances', data };
}

// Test-only dependency injection.
export function __setAccountDepsForTest(overrides = {}) {
  Object.assign(deps, overrides);
}

export function __resetAccountDepsForTest() {
  Object.assign(deps, defaultDeps);
}

export default {
  addReadonly, addApi, addMaster, updateMaster, removeMaster,
  ls, remove, setDefault,
  clearPasswordCache,
  positions, balances, orders, fills,
  orderHistory, fundingHistory, twapHistory, twapFillHistory,
  portfolio,
};
