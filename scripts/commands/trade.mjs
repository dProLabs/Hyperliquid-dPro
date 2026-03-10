import * as exchangeClient from '../clients/exchange-client.mjs';
import * as infoClient from '../clients/info-client.mjs';
import { resolveAsset } from '../resolvers/asset-resolver.mjs';
import { resolveAccount } from '../resolvers/account-resolver.mjs';
import { findRelatedSymbols, findMarket } from '../resolvers/market-resolver.mjs';
import { getAgentPrivateKey } from '../store.mjs';
import { generateCloid } from '../utils/ids.mjs';
import { priceToWire, sizeToWire } from '../utils/numbers.mjs';
import { assertSide, assertPositiveNumber, assertPositiveInteger, assertTif, assertCoin } from '../utils/validate.mjs';
import { inputError, privateKeyMissing, assetNotFound } from '../errors.mjs';
import { BUILDER_ADDRESS, BUILDER_MAX_FEE_RATE, DEFAULT_SLIPPAGE_PCT } from '../constants.mjs';

const defaultDeps = {
  exchangeClient,
  infoClient,
  resolveAsset,
  resolveAccount,
  findRelatedSymbols,
  findMarket,
  getAgentPrivateKey,
};
const deps = { ...defaultDeps };
const TRADE_MARKET_TYPES = new Set(['spot', 'perp', 'hip3']);
const INSUFFICIENT_MARGIN_PATTERNS = [
  'insufficient margin',
  'insufficient balance',
  'not enough collateral',
  'insufficient collateral',
];

function getTradeContext(parsed, ctx) {
  const account = deps.resolveAccount(parsed.flags?.account || null);
  if (account.mode !== 'api') {
    throw privateKeyMissing(account.alias + ' (account is read-only)');
  }
  const privateKey = deps.getAgentPrivateKey(account.alias);
  const isTestnet = ctx?.network === 'testnet';
  return { account, privateKey, isTestnet };
}

function assertMarketType(parsed) {
  const marketType = parsed?.marketType;
  if (!TRADE_MARKET_TYPES.has(marketType)) {
    throw inputError('Trade command requires explicit market namespace: spot, perp, or hip3.');
  }
  return marketType;
}

function isNamespacedCoin(coin) {
  return String(coin).includes(':');
}

function validateNamespaceCoinPair(coin, marketType) {
  const namespaced = isNamespacedCoin(coin);
  if (marketType === 'hip3' && !namespaced) {
    throw inputError(`HIP-3 commands require namespaced symbols like "xyz:NVDA". Got: ${coin}`);
  }
  if (marketType === 'perp' && namespaced) {
    throw inputError(`Perp commands do not accept namespaced HIP-3 symbols. Use "dpro-hl hip3 order ..." for ${coin}.`);
  }
}

function assertReduceOnlyAllowed(marketType, flags = {}) {
  if (marketType === 'spot' && flags['reduce-only']) {
    throw inputError('`--reduce-only` is not supported for spot orders.');
  }
}

async function resolveAssetWithNamespace(coin, marketType, isTestnet = false) {
  const hint = marketType === 'spot' ? 'spot' : 'perp';
  try {
    const assetInfo = await deps.resolveAsset(coin, hint, { isTestnet });
    if (marketType === 'spot' && assetInfo.kind !== 'spot') {
      throw inputError(`${coin} is not a spot market.`);
    }
    if (marketType !== 'spot' && assetInfo.kind !== 'perp') {
      throw inputError(`${coin} is not a perp-style market.`);
    }
    return assetInfo;
  } catch (err) {
    if (err?.code === 'INPUT_ERROR') throw err;
    if (err?.code !== 'ASSET_NOT_FOUND') throw err;
    const related = await deps.findRelatedSymbols(coin, 6, { isTestnet });
    const hints = [];
    if (related.length) hints.push(`Related symbols: ${related.join(', ')}.`);
    if (String(coin).includes(':') || related.some(s => s.includes(':'))) {
      hints.push('AAPL and xyz:AAPL are different assets; use the exact coin from "dpro-hl markets ls".');
    }
    throw assetNotFound(coin, hints.join(' '));
  }
}

async function resolveOrderNamespace(order, isTestnet = false) {
  const coin = assertCoin(order?.coin);
  if (isNamespacedCoin(coin)) return 'hip3';

  let spotAsset = null;
  let perpAsset = null;
  try {
    const resolved = await deps.resolveAsset(coin, 'spot', { isTestnet });
    if (resolved?.kind === 'spot') spotAsset = resolved;
  } catch (err) {
    if (err?.code !== 'ASSET_NOT_FOUND') throw err;
  }
  try {
    const resolved = await deps.resolveAsset(coin, 'perp', { isTestnet });
    if (resolved?.kind === 'perp') perpAsset = resolved;
  } catch (err) {
    if (err?.code !== 'ASSET_NOT_FOUND') throw err;
  }

  if (spotAsset && !perpAsset) return 'spot';
  if (!spotAsset && perpAsset) return 'perp';
  if (!spotAsset && !perpAsset) {
    throw inputError(`Unable to classify order market namespace for ${coin}.`);
  }

  const orderAsset = Number(order?.asset);
  if (Number.isFinite(orderAsset)) {
    if (orderAsset === Number(spotAsset.asset)) return 'spot';
    if (orderAsset === Number(perpAsset.asset)) return 'perp';
  }

  return 'ambiguous';
}

function parseOrderResponse(response, coin, side, size, price) {
  const data = { coin, side, size, price };

  const statuses = response?.response?.data?.statuses ||
    response?.data?.statuses ||
    response?.statuses ||
    [];

  if (Array.isArray(statuses) && statuses.length > 0) {
    const st = statuses[0];
    if (st?.resting) {
      data.status = 'resting';
      data.oid = st.resting.oid;
    } else if (st?.filled) {
      data.status = 'filled';
      data.oid = st.filled.oid;
      data.avgPx = st.filled.avgPx;
      data.totalSz = st.filled.totalSz;
    } else if (st?.error) {
      data.status = 'error';
      data.error = st.error;
      if (isInsufficientMarginLike(st.error)) data.errorClass = 'INSUFFICIENT_MARGIN';
    } else if (typeof st === 'string') {
      data.status = st.toLowerCase() === 'success' ? 'submitted' : 'unknown';
    } else {
      data.status = 'unknown';
    }
  } else if (response?.status === 'err' || response?.error) {
    data.status = 'error';
    data.error = response?.error || response?.response || 'Unknown error';
    if (isInsufficientMarginLike(data.error)) data.errorClass = 'INSUFFICIENT_MARGIN';
  } else {
    data.status = 'submitted';
  }

  return data;
}

function isInsufficientMarginLike(errorMessage) {
  const text = String(errorMessage || '').toLowerCase();
  return INSUFFICIENT_MARGIN_PATTERNS.some((p) => text.includes(p));
}

function getOrderRejectionWarning(data) {
  if (data?.status !== 'error') return null;
  if (data?.errorClass !== 'INSUFFICIENT_MARGIN') return null;
  return 'Order rejected by venue: insufficient balance or margin. Check balances/collateral and retry with smaller size if needed.';
}

function trimTrailingZeros(numStr) {
  return String(numStr).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

function validateOrderWireValues({ coin, sizeInput, sizeWire, szDecimals, priceWire }) {
  const wireSizeNum = Number(sizeWire);
  if (!Number.isFinite(wireSizeNum) || wireSizeNum <= 0) {
    const minStep = szDecimals != null ? trimTrailingZeros((1 / Math.pow(10, Number(szDecimals))).toFixed(Number(szDecimals))) : null;
    throw inputError(
      minStep
        ? `Order size ${sizeInput} ${coin} is below minimum step ${minStep} for this market.`
        : `Order size ${sizeInput} ${coin} is too small for this market.`,
    );
  }

  const wirePriceNum = Number(priceWire);
  if (!Number.isFinite(wirePriceNum) || wirePriceNum <= 0) {
    throw inputError(`Order price is invalid after normalization: ${priceWire}`);
  }
}

// Test-only export for response normalization behavior.
export function __parseOrderResponseForTest(response, coin, side, size, price) {
  return parseOrderResponse(response, coin, side, size, price);
}

export function __isInsufficientMarginLikeForTest(errorMessage) {
  return isInsufficientMarginLike(errorMessage);
}

// Test-only export for wire preflight validation.
export function __validateOrderWireValuesForTest(args) {
  return validateOrderWireValues(args);
}

// Test-only dependency injection for command-level behavior tests.
export function __setTradeDepsForTest(overrides = {}) {
  Object.assign(deps, overrides);
}

export function __resetTradeDepsForTest() {
  Object.assign(deps, defaultDeps);
}

async function limit(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  const { side, size, price } = parsed.args;
  assertSide(side);
  assertPositiveNumber(size, 'size');
  assertPositiveNumber(price, 'price');
  const coin = assertCoin(parsed.target);
  validateNamespaceCoinPair(coin, marketType);
  assertReduceOnlyAllowed(marketType, parsed.flags);

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithNamespace(coin, marketType, isTestnet);

  const tif = parsed.flags?.tif ? assertTif(parsed.flags.tif) : 'Gtc';
  const reduceOnly = !!parsed.flags?.['reduce-only'];
  const cloid = generateCloid();
  const wirePrice = priceToWire(price);
  const wireSize = sizeToWire(size, assetInfo.szDecimals);

  validateOrderWireValues({
    coin,
    sizeInput: size,
    sizeWire: wireSize,
    szDecimals: assetInfo.szDecimals,
    priceWire: wirePrice,
  });

  const orderSpec = {
    asset: assetInfo.asset,
    isBuy: side === 'buy',
    price: wirePrice,
    size: wireSize,
    reduceOnly,
    orderType: { limit: { tif } },
  };

  const response = await deps.exchangeClient.placeOrder(
    orderSpec, privateKey, account.agentAddress,
    { isTestnet, cloid }
  );

  const data = parseOrderResponse(response, coin, side, size, price);
  const warning = getOrderRejectionWarning(data);
  return { ok: true, type: 'order_result', data, ...(warning ? { warnings: [warning] } : {}) };
}

async function market(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  const { side, size } = parsed.args;
  assertSide(side);
  assertPositiveNumber(size, 'size');
  const coin = assertCoin(parsed.target);
  validateNamespaceCoinPair(coin, marketType);
  assertReduceOnlyAllowed(marketType, parsed.flags);

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);

  // Fetch mid price and resolve asset in parallel
  const [mids, assetInfo, marketInfo] = await Promise.all([
    deps.infoClient.getAllMids({ isTestnet }),
    resolveAssetWithNamespace(coin, marketType, isTestnet),
    deps.findMarket(coin, { isTestnet }),
  ]);

  const m = mids || {};
  const suffix = String(coin).includes(':') ? String(coin).split(':').slice(-1)[0] : null;
  const mid = Number(
    m[coin] ||
    m[assetInfo?.apiName] ||
    m[assetInfo?.coin] ||
    (suffix ? m[suffix] : null) ||
    marketInfo?.ctx?.midPx ||
    marketInfo?.ctx?.markPx
  );
  if (!mid) throw inputError(`No mid price available for ${coin}`);

  // Calculate slippage-protected price
  const slippagePct = Number(parsed.flags?.slippage) || DEFAULT_SLIPPAGE_PCT;
  const slippageMul = side === 'buy' ? (1 + slippagePct / 100) : (1 - slippagePct / 100);
  const protectionPrice = mid * slippageMul;

  const cloid = generateCloid();
  const wirePrice = priceToWire(protectionPrice);
  const wireSize = sizeToWire(size, assetInfo.szDecimals);

  validateOrderWireValues({
    coin,
    sizeInput: size,
    sizeWire: wireSize,
    szDecimals: assetInfo.szDecimals,
    priceWire: wirePrice,
  });

  const orderSpec = {
    asset: assetInfo.asset,
    isBuy: side === 'buy',
    price: wirePrice,
    size: wireSize,
    reduceOnly: !!parsed.flags?.['reduce-only'],
    orderType: { limit: { tif: 'Ioc' } }, // Market = IOC with slippage
  };

  const response = await deps.exchangeClient.placeOrder(
    orderSpec, privateKey, account.agentAddress,
    { isTestnet, cloid }
  );

  const data = parseOrderResponse(response, coin, side, size, protectionPrice);
  const warnings = [];
  const rejectionWarning = getOrderRejectionWarning(data);
  if (rejectionWarning) warnings.push(rejectionWarning);
  warnings.push(`Market order executed as IOC @ ${wirePrice} (mid: ${mid}, slippage: ${slippagePct}%)`);
  return { ok: true, type: 'order_result', data, warnings };
}

async function cancel(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  const oid = parsed.target;
  if (!oid) throw inputError(`Usage: dpro-hl ${marketType} order cancel <oid>`);

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);

  // We need the asset for cancel — get from open orders
  const openOrders = await deps.infoClient.getOpenOrders(account.masterAddress, { isTestnet, dex: 'ALL_DEXS' });
  const order = openOrders?.find(o => String(o.oid) === String(oid));
  if (!order) throw inputError(`Order ${oid} not found in open orders.`);

  const orderNamespace = await resolveOrderNamespace(order, isTestnet);
  if (orderNamespace === 'ambiguous') {
    throw inputError(`Order ${oid} is ambiguous between spot and perp. Use explicit coin + cloid in the target namespace.`);
  }
  if (orderNamespace !== marketType) {
    throw inputError(`Order ${oid} belongs to ${orderNamespace}, not ${marketType}.`);
  }

  const orderCoin = assertCoin(order.coin);
  validateNamespaceCoinPair(orderCoin, marketType);
  const assetInfo = await resolveAssetWithNamespace(orderCoin, marketType, isTestnet);

  const response = await deps.exchangeClient.cancelOrders(
    [{ asset: assetInfo.asset, oid: Number(oid) }],
    privateKey, account.agentAddress,
    { isTestnet }
  );

  const success = response?.status === 'ok' ||
    response?.response?.type === 'cancel' ||
    (response?.response?.data?.statuses?.[0] === 'success');

  return {
    ok: true,
    type: 'cancel_result',
    data: { oid, cancelled: !!success, error: success ? null : JSON.stringify(response) },
  };
}

async function cancelAll(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);

  const openOrders = await deps.infoClient.getOpenOrders(account.masterAddress, { isTestnet, dex: 'ALL_DEXS' });
  if (!openOrders?.length) {
    return { ok: true, type: 'cancel-all_result', data: { count: 0 } };
  }

  // Group cancels by namespace.
  const cancels = [];
  for (const o of openOrders) {
    const namespace = await resolveOrderNamespace(o, isTestnet);
    if (namespace !== marketType) continue;
    const orderCoin = assertCoin(o.coin);
    validateNamespaceCoinPair(orderCoin, marketType);
    const assetInfo = await resolveAssetWithNamespace(orderCoin, marketType, isTestnet);
    cancels.push({ asset: assetInfo.asset, oid: o.oid });
  }

  if (!cancels.length) {
    return { ok: true, type: 'cancel-all_result', data: { count: 0 } };
  }

  await deps.exchangeClient.cancelOrders(cancels, privateKey, account.agentAddress, { isTestnet });

  return { ok: true, type: 'cancel-all_result', data: { count: cancels.length } };
}

async function cancelByCloid(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  const coin = assertCoin(parsed.target);
  validateNamespaceCoinPair(coin, marketType);
  const cloid = parsed.args?.cloid;
  if (!cloid) throw inputError(`Usage: dpro-hl ${marketType} order cancel-by-cloid <coin> <cloid>`);

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithNamespace(coin, marketType, isTestnet);

  const response = await deps.exchangeClient.cancelByCloid(
    assetInfo.asset, cloid, privateKey, account.agentAddress, { isTestnet }
  );

  return {
    ok: true,
    type: 'cancel_result',
    data: { oid: cloid, cancelled: true },
  };
}

async function setLeverage(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  const coin = assertCoin(parsed.target);
  validateNamespaceCoinPair(coin, marketType);
  const leverage = assertPositiveInteger(parsed.args?.leverage, 'leverage');
  if (marketType === 'spot') {
    throw inputError('Cannot set leverage on spot markets.');
  }

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithNamespace(coin, marketType, isTestnet);

  if (assetInfo.kind === 'spot') {
    throw inputError('Cannot set leverage on spot markets.');
  }

  const isCross = !parsed.flags?.isolated; // default cross

  await deps.exchangeClient.updateLeverage(
    assetInfo.asset, isCross, leverage, privateKey, account.agentAddress, { isTestnet }
  );

  return {
    ok: true,
    type: 'leverage_result',
    data: { coin, leverage, mode: isCross ? 'cross' : 'isolated' },
  };
}

async function topupIsolated(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  const coin = assertCoin(parsed.target);
  validateNamespaceCoinPair(coin, marketType);
  const usd = assertPositiveNumber(parsed.args?.usd, 'USD amount');
  if (marketType === 'spot') {
    throw inputError('Cannot topup isolated margin on spot markets.');
  }

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithNamespace(coin, marketType, isTestnet);

  if (assetInfo.kind === 'spot') {
    throw inputError('Cannot topup isolated margin on spot markets.');
  }

  // ntli is in raw integer form — the amount in USD
  // Positive = add margin
  const ntli = Math.round(usd * 1e6); // 6 decimal places

  await deps.exchangeClient.updateIsolatedMargin(
    assetInfo.asset, true, ntli, privateKey, account.agentAddress, { isTestnet }
  );

  return { ok: true, type: 'topup_result', data: { coin, usd } };
}

async function approveBuilder(parsed, ctx) {
  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);

  const maxFeeRate = BUILDER_MAX_FEE_RATE;
  await deps.exchangeClient.approveBuilderFee(
    maxFeeRate, BUILDER_ADDRESS, privateKey, account.agentAddress, { isTestnet }
  );

  return { ok: true, type: 'approve-builder_result', data: { builderAddress: BUILDER_ADDRESS } };
}

export default {
  limit, market, cancel, cancelAll, cancelByCloid,
  setLeverage, topupIsolated, approveBuilder,
};
