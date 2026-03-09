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

function getTradeContext(parsed, ctx) {
  const account = deps.resolveAccount(parsed.flags?.account || null);
  if (account.mode !== 'api') {
    throw privateKeyMissing(account.alias + ' (account is read-only)');
  }
  const privateKey = deps.getAgentPrivateKey(account.alias);
  const isTestnet = ctx?.network === 'testnet';
  return { account, privateKey, isTestnet };
}

async function resolveAssetWithHints(coin, isTestnet = false) {
  try {
    return await deps.resolveAsset(coin, 'perp', { isTestnet });
  } catch (err) {
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
    } else if (typeof st === 'string') {
      data.status = st.toLowerCase() === 'success' ? 'submitted' : 'unknown';
    } else {
      data.status = 'unknown';
    }
  } else if (response?.status === 'err' || response?.error) {
    data.status = 'error';
    data.error = response?.error || response?.response || 'Unknown error';
  } else {
    data.status = 'submitted';
  }

  return data;
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
  const { side, size, price } = parsed.args;
  assertSide(side);
  assertPositiveNumber(size, 'size');
  assertPositiveNumber(price, 'price');
  const coin = assertCoin(parsed.target);

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithHints(coin, isTestnet);

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
  return { ok: true, type: 'order_result', data };
}

async function market(parsed, ctx) {
  const { side, size } = parsed.args;
  assertSide(side);
  assertPositiveNumber(size, 'size');
  const coin = assertCoin(parsed.target);

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);

  // Fetch mid price and resolve asset in parallel
  const [mids, assetInfo, marketInfo] = await Promise.all([
    deps.infoClient.getAllMids({ isTestnet }),
    resolveAssetWithHints(coin, isTestnet),
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
  const warnings = [`Market order executed as IOC @ ${wirePrice} (mid: ${mid}, slippage: ${slippagePct}%)`];
  return { ok: true, type: 'order_result', data, warnings };
}

async function cancel(parsed, ctx) {
  const oid = parsed.target;
  if (!oid) throw inputError('Usage: dpro-hl order cancel <oid>');

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);

  // We need the asset for cancel — get from open orders
  const openOrders = await deps.infoClient.getOpenOrders(account.masterAddress, { isTestnet, dex: 'ALL_DEXS' });
  const order = openOrders?.find(o => String(o.oid) === String(oid));
  if (!order) throw inputError(`Order ${oid} not found in open orders.`);

  const assetInfo = await resolveAssetWithHints(order.coin, isTestnet);

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
  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);

  const openOrders = await deps.infoClient.getOpenOrders(account.masterAddress, { isTestnet, dex: 'ALL_DEXS' });
  if (!openOrders?.length) {
    return { ok: true, type: 'cancel-all_result', data: { count: 0 } };
  }

  // Group cancels — need asset resolution for each
  const cancels = [];
  for (const o of openOrders) {
    const assetInfo = await resolveAssetWithHints(o.coin, isTestnet);
    cancels.push({ asset: assetInfo.asset, oid: o.oid });
  }

  await deps.exchangeClient.cancelOrders(cancels, privateKey, account.agentAddress, { isTestnet });

  return { ok: true, type: 'cancel-all_result', data: { count: cancels.length } };
}

async function cancelByCloid(parsed, ctx) {
  const coin = assertCoin(parsed.target);
  const cloid = parsed.args?.cloid;
  if (!cloid) throw inputError('Usage: dpro-hl order cancel-by-cloid <coin> <cloid>');

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithHints(coin, isTestnet);

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
  const coin = assertCoin(parsed.target);
  const leverage = assertPositiveInteger(parsed.args?.leverage, 'leverage');

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithHints(coin, isTestnet);

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
  const coin = assertCoin(parsed.target);
  const usd = assertPositiveNumber(parsed.args?.usd, 'USD amount');

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithHints(coin, isTestnet);

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
