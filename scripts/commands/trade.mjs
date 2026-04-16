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
import { BUILDER_ADDRESS, BUILDER_FEE, BUILDER_MAX_FEE_RATE, DEFAULT_SLIPPAGE_PCT } from '../constants.mjs';

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
const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const BUILDER_NOT_APPROVED_MESSAGE = 'Please log in to https://www.d.pro/ to get trading fee discounts.';

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

function isEthAddress(value) {
  return ETH_ADDRESS_RE.test(String(value || ''));
}

function normalizeMaxBuilderFee(value) {
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber) || asNumber <= 0) return 0;
  return Math.max(0, Math.floor(asNumber));
}

function resolveBuilderApprovalUser(parsed) {
  const explicitUser = parsed?.target || parsed?.flags?.user || parsed?.flags?.account || null;
  if (explicitUser && isEthAddress(explicitUser)) {
    return explicitUser;
  }
  const account = deps.resolveAccount(explicitUser || null);
  return account.masterAddress;
}

function resolveBuilderAddress(parsed) {
  const builder = String(parsed?.flags?.builder || BUILDER_ADDRESS);
  if (!isEthAddress(builder)) {
    throw inputError(`Invalid builder address: ${builder}`);
  }
  return builder;
}

async function resolveBuilderForOrder(masterAddress, isTestnet = false) {
  try {
    const maxBuilderFee = normalizeMaxBuilderFee(
      await deps.infoClient.getMaxBuilderFee(masterAddress, BUILDER_ADDRESS, { isTestnet }),
    );

    if (maxBuilderFee <= 0) {
      return { builder: null, notice: BUILDER_NOT_APPROVED_MESSAGE, warning: null };
    }

    return {
      builder: {
        b: BUILDER_ADDRESS,
        f: Math.min(BUILDER_FEE, maxBuilderFee),
      },
      notice: null,
      warning: null,
    };
  } catch {
    return {
      builder: null,
      notice: null,
      warning: `Builder approval check failed for ${BUILDER_ADDRESS}; order submitted without builder fee.`,
    };
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

function validateWireSizeOnly({ coin, sizeInput, sizeWire, szDecimals }) {
  const wireSizeNum = Number(sizeWire);
  if (!Number.isFinite(wireSizeNum) || wireSizeNum <= 0) {
    const minStep = szDecimals != null ? trimTrailingZeros((1 / Math.pow(10, Number(szDecimals))).toFixed(Number(szDecimals))) : null;
    throw inputError(
      minStep
        ? `Order size ${sizeInput} ${coin} is below minimum step ${minStep} for this market.`
        : `Order size ${sizeInput} ${coin} is too small for this market.`,
    );
  }
}

function parseOrderIdentifier(raw) {
  const input = String(raw || '').trim();
  if (!input) throw inputError('Order identifier is required.');
  if (/^\d+$/.test(input)) return Number(input);
  return input;
}

function parseBatchLimitEntries(raw) {
  const source = String(raw || '').trim();
  if (!source) {
    throw inputError('Batch entries are required. Use format: <size@price,size@price,...>');
  }
  const entries = source.split(',').map((s) => s.trim()).filter(Boolean);
  if (!entries.length) {
    throw inputError('Batch entries are required. Use format: <size@price,size@price,...>');
  }
  return entries.map((entry) => {
    const [size, price, ...rest] = entry.split('@');
    if (!size || !price || rest.length) {
      throw inputError(`Invalid batch entry "${entry}". Expected "size@price".`);
    }
    assertPositiveNumber(size, 'size');
    assertPositiveNumber(price, 'price');
    return { size, price };
  });
}

function parseBatchCancelIds(raw) {
  const ids = String(raw || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!ids.length) {
    throw inputError('Usage: dpro-hl <spot|perp|hip3> order cancel-multiple <oid1,oid2,...>');
  }
  return ids;
}

function parseGenericStatus(response, successStatus = 'submitted') {
  const statuses = response?.response?.data?.statuses || response?.data?.statuses || response?.statuses || [];
  if (Array.isArray(statuses) && statuses.length > 0) {
    const first = statuses[0];
    if (first?.error) return { status: 'error', error: first.error };
    if (typeof first === 'string') {
      return { status: first.toLowerCase() === 'success' ? successStatus : 'unknown', rawStatus: first };
    }
    return { status: successStatus };
  }
  if (response?.status === 'err' || response?.error) {
    return { status: 'error', error: response?.error || response?.response || 'Unknown error' };
  }
  return { status: successStatus };
}

function parseTwapCreateResponse(response) {
  const twapStatus = response?.response?.data?.status || response?.data?.status || null;
  if (twapStatus?.error) {
    return { status: 'error', error: twapStatus.error, twapId: null };
  }
  if (twapStatus?.running?.twapId != null) {
    return { status: 'running', error: null, twapId: twapStatus.running.twapId };
  }
  return { status: 'submitted', error: null, twapId: null };
}

function inferPerpDexFromMeta(meta, dexIndex) {
  if (dexIndex === 0) return '';
  const firstName = meta?.universe?.[0]?.name || '';
  if (!firstName) return '';
  return firstName.includes(':') ? firstName.split(':')[0] : firstName;
}

async function loadPerpStatesForUser(user, isTestnet) {
  try {
    const metas = await deps.infoClient.getAllPerpMetas({ isTestnet });
    if (!Array.isArray(metas) || !metas.length) {
      return [await deps.infoClient.getClearinghouseState(user, { isTestnet })];
    }
    const states = await Promise.all(
      metas.map((meta, dexIndex) => deps.infoClient.getClearinghouseState(
        user,
        { isTestnet, dex: inferPerpDexFromMeta(meta, dexIndex) },
      )),
    );
    return states.filter(Boolean);
  } catch {
    return [await deps.infoClient.getClearinghouseState(user, { isTestnet })];
  }
}

async function getPositionForCoin(masterAddress, coin, isTestnet) {
  const wanted = String(coin || '').toUpperCase();
  const states = await loadPerpStatesForUser(masterAddress, isTestnet);
  for (const state of states) {
    for (const ap of (state?.assetPositions || [])) {
      const pos = ap?.position;
      if (!pos || Number(pos.szi) === 0) continue;
      if (String(pos.coin || '').toUpperCase() === wanted) {
        return pos;
      }
    }
  }
  return null;
}

async function resolveMidPriceForCoin(coin, assetInfo, isTestnet) {
  const [mids, marketInfo] = await Promise.all([
    deps.infoClient.getAllMids({ isTestnet }),
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
    marketInfo?.ctx?.markPx,
  );
  if (!mid) throw inputError(`No mid price available for ${coin}`);
  return mid;
}

async function placeIocMarketLikeOrder({
  account,
  privateKey,
  isTestnet,
  assetInfo,
  coin,
  side,
  size,
  reduceOnly,
  slippagePct,
}) {
  const mid = await resolveMidPriceForCoin(coin, assetInfo, isTestnet);
  const slippageMul = side === 'buy' ? (1 + slippagePct / 100) : (1 - slippagePct / 100);
  const protectionPrice = mid * slippageMul;
  const wirePrice = priceToWire(protectionPrice);
  const wireSize = sizeToWire(size, assetInfo.szDecimals);
  validateOrderWireValues({
    coin,
    sizeInput: size,
    sizeWire: wireSize,
    szDecimals: assetInfo.szDecimals,
    priceWire: wirePrice,
  });

  const builderDecision = await resolveBuilderForOrder(account.masterAddress, isTestnet);
  const response = await deps.exchangeClient.placeOrder(
    {
      asset: assetInfo.asset,
      isBuy: side === 'buy',
      price: wirePrice,
      size: wireSize,
      reduceOnly: !!reduceOnly,
      orderType: { limit: { tif: 'Ioc' } },
    },
    privateKey,
    account.agentAddress,
    {
      isTestnet,
      cloid: generateCloid(),
      ...(builderDecision.builder ? { builder: builderDecision.builder } : {}),
    },
  );

  const data = parseOrderResponse(response, coin, side, size, protectionPrice);
  const notices = [];
  if (builderDecision.notice) notices.push(builderDecision.notice);
  const warnings = [];
  if (builderDecision.warning) warnings.push(builderDecision.warning);
  const rejectionWarning = getOrderRejectionWarning(data);
  if (rejectionWarning) warnings.push(rejectionWarning);
  warnings.push(`Market order executed as IOC @ ${wirePrice} (mid: ${mid}, slippage: ${slippagePct}%)`);
  return { data, notices, warnings };
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

  const builderDecision = await resolveBuilderForOrder(account.masterAddress, isTestnet);

  const response = await deps.exchangeClient.placeOrder(
    orderSpec, privateKey, account.agentAddress,
    {
      isTestnet,
      cloid,
      ...(builderDecision.builder ? { builder: builderDecision.builder } : {}),
    }
  );

  const data = parseOrderResponse(response, coin, side, size, price);
  const notices = [];
  if (builderDecision.notice) notices.push(builderDecision.notice);
  const warnings = [];
  if (builderDecision.warning) warnings.push(builderDecision.warning);
  const rejectionWarning = getOrderRejectionWarning(data);
  if (rejectionWarning) warnings.push(rejectionWarning);
  return {
    ok: true,
    type: 'order_result',
    data,
    ...(notices.length ? { notices } : {}),
    ...(warnings.length ? { warnings } : {}),
  };
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

  const builderDecision = await resolveBuilderForOrder(account.masterAddress, isTestnet);

  const response = await deps.exchangeClient.placeOrder(
    orderSpec, privateKey, account.agentAddress,
    {
      isTestnet,
      cloid,
      ...(builderDecision.builder ? { builder: builderDecision.builder } : {}),
    }
  );

  const data = parseOrderResponse(response, coin, side, size, protectionPrice);
  const notices = [];
  if (builderDecision.notice) notices.push(builderDecision.notice);
  const warnings = [];
  if (builderDecision.warning) warnings.push(builderDecision.warning);
  const rejectionWarning = getOrderRejectionWarning(data);
  if (rejectionWarning) warnings.push(rejectionWarning);
  warnings.push(`Market order executed as IOC @ ${wirePrice} (mid: ${mid}, slippage: ${slippagePct}%)`);
  return {
    ok: true,
    type: 'order_result',
    data,
    ...(notices.length ? { notices } : {}),
    warnings,
  };
}

async function modify(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  const oid = parseOrderIdentifier(parsed.target);
  const side = assertSide(parsed.args?.side);
  const size = parsed.args?.size;
  const price = parsed.args?.price;
  const coin = assertCoin(parsed.args?.coin);
  assertPositiveNumber(size, 'size');
  assertPositiveNumber(price, 'price');
  validateNamespaceCoinPair(coin, marketType);
  assertReduceOnlyAllowed(marketType, parsed.flags);

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithNamespace(coin, marketType, isTestnet);
  const tif = parsed.flags?.tif ? assertTif(parsed.flags.tif) : 'Gtc';
  const reduceOnly = !!parsed.flags?.['reduce-only'];
  const wirePrice = priceToWire(price);
  const wireSize = sizeToWire(size, assetInfo.szDecimals);

  validateOrderWireValues({
    coin,
    sizeInput: size,
    sizeWire: wireSize,
    szDecimals: assetInfo.szDecimals,
    priceWire: wirePrice,
  });

  const response = await deps.exchangeClient.modifyOrder(
    oid,
    {
      asset: assetInfo.asset,
      isBuy: side === 'buy',
      price: wirePrice,
      size: wireSize,
      reduceOnly,
      orderType: { limit: { tif } },
      cloid: parsed.flags?.cloid ? String(parsed.flags.cloid) : undefined,
    },
    privateKey,
    account.agentAddress,
    { isTestnet },
  );

  const status = parseGenericStatus(response, 'modified');
  return {
    ok: true,
    type: 'modify_result',
    data: {
      oid,
      coin,
      side,
      size,
      price,
      ...status,
    },
  };
}

async function twapCreate(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  const side = assertSide(parsed.args?.side);
  const size = parsed.args?.size;
  assertPositiveNumber(size, 'size');
  const coin = assertCoin(parsed.target);
  validateNamespaceCoinPair(coin, marketType);
  assertReduceOnlyAllowed(marketType, parsed.flags);

  const minutes = assertPositiveInteger(parsed.flags?.minutes || parsed.flags?.duration, 'minutes');
  if (minutes < 5 || minutes > 1440) {
    throw inputError('minutes must be between 5 and 1440.');
  }

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithNamespace(coin, marketType, isTestnet);
  const wireSize = sizeToWire(size, assetInfo.szDecimals);
  validateWireSizeOnly({
    coin,
    sizeInput: size,
    sizeWire: wireSize,
    szDecimals: assetInfo.szDecimals,
  });

  const response = await deps.exchangeClient.twapOrder(
    assetInfo.asset,
    side === 'buy',
    wireSize,
    !!parsed.flags?.['reduce-only'],
    minutes,
    !!parsed.flags?.randomize,
    privateKey,
    account.agentAddress,
    { isTestnet },
  );

  return {
    ok: true,
    type: 'twap_result',
    data: {
      action: 'create',
      coin,
      side,
      size,
      minutes,
      randomize: !!parsed.flags?.randomize,
      ...parseTwapCreateResponse(response),
    },
  };
}

async function twapCancel(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  const coin = assertCoin(parsed.target);
  validateNamespaceCoinPair(coin, marketType);
  const twapId = assertPositiveInteger(parsed.args?.twapId, 'twapId');

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithNamespace(coin, marketType, isTestnet);
  const response = await deps.exchangeClient.twapCancel(
    assetInfo.asset,
    twapId,
    privateKey,
    account.agentAddress,
    { isTestnet },
  );

  const status = parseGenericStatus(response, 'cancelled');
  return {
    ok: true,
    type: 'twap_result',
    data: {
      action: 'cancel',
      coin,
      twapId,
      ...status,
    },
  };
}

async function batchLimit(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  const side = assertSide(parsed.args?.side);
  const coin = assertCoin(parsed.target);
  validateNamespaceCoinPair(coin, marketType);
  assertReduceOnlyAllowed(marketType, parsed.flags);
  const entries = parseBatchLimitEntries(parsed.args?.entries);

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithNamespace(coin, marketType, isTestnet);
  const tif = parsed.flags?.tif ? assertTif(parsed.flags.tif) : 'Gtc';
  const reduceOnly = !!parsed.flags?.['reduce-only'];

  const orders = entries.map((entry) => {
    const wirePrice = priceToWire(entry.price);
    const wireSize = sizeToWire(entry.size, assetInfo.szDecimals);
    validateOrderWireValues({
      coin,
      sizeInput: entry.size,
      sizeWire: wireSize,
      szDecimals: assetInfo.szDecimals,
      priceWire: wirePrice,
    });
    return {
      asset: assetInfo.asset,
      isBuy: side === 'buy',
      price: wirePrice,
      size: wireSize,
      reduceOnly,
      orderType: { limit: { tif } },
      cloid: generateCloid(),
    };
  });

  const builderDecision = await resolveBuilderForOrder(account.masterAddress, isTestnet);
  const response = await deps.exchangeClient.placeOrders(
    orders,
    privateKey,
    account.agentAddress,
    {
      isTestnet,
      ...(builderDecision.builder ? { builder: builderDecision.builder } : {}),
    },
  );

  const statuses = response?.response?.data?.statuses || response?.data?.statuses || response?.statuses || [];
  const results = entries.map((entry, idx) => {
    const st = statuses[idx];
    if (st?.resting) return { ...entry, status: 'resting', oid: st.resting.oid };
    if (st?.filled) return { ...entry, status: 'filled', oid: st.filled.oid };
    if (st?.error) return { ...entry, status: 'error', error: st.error };
    if (typeof st === 'string') return { ...entry, status: st.toLowerCase() === 'success' ? 'submitted' : 'unknown' };
    return { ...entry, status: 'submitted' };
  });

  const notices = [];
  if (builderDecision.notice) notices.push(builderDecision.notice);
  const warnings = [];
  if (builderDecision.warning) warnings.push(builderDecision.warning);

  return {
    ok: true,
    type: 'batch_order_result',
    data: {
      coin,
      side,
      total: entries.length,
      submitted: results.filter((r) => r.status !== 'error').length,
      errors: results.filter((r) => r.status === 'error').length,
      results,
    },
    ...(notices.length ? { notices } : {}),
    ...(warnings.length ? { warnings } : {}),
  };
}

async function cancelMultiple(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  const ids = parseBatchCancelIds(parsed.args?.oids);
  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);

  const openOrders = await deps.infoClient.getOpenOrders(account.masterAddress, { isTestnet, dex: 'ALL_DEXS' });
  const cancels = [];
  const skipped = [];

  for (const id of ids) {
    const order = (openOrders || []).find((o) => String(o.oid) === String(id));
    if (!order) {
      skipped.push({ oid: id, reason: 'not-found' });
      continue;
    }
    const orderNamespace = await resolveOrderNamespace(order, isTestnet);
    if (orderNamespace !== marketType) {
      skipped.push({ oid: id, reason: `belongs-to-${orderNamespace}` });
      continue;
    }
    const orderCoin = assertCoin(order.coin);
    validateNamespaceCoinPair(orderCoin, marketType);
    const assetInfo = await resolveAssetWithNamespace(orderCoin, marketType, isTestnet);
    cancels.push({ asset: assetInfo.asset, oid: Number(order.oid) });
  }

  if (cancels.length) {
    await deps.exchangeClient.cancelOrders(cancels, privateKey, account.agentAddress, { isTestnet });
  }

  return {
    ok: true,
    type: 'cancel-multiple_result',
    data: {
      requested: ids.length,
      cancelled: cancels.length,
      skipped,
    },
  };
}

async function closePosition(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  if (marketType === 'spot') {
    throw inputError('close-position is only supported for perp/hip3 positions.');
  }
  const coin = assertCoin(parsed.target);
  validateNamespaceCoinPair(coin, marketType);

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithNamespace(coin, marketType, isTestnet);
  const position = await getPositionForCoin(account.masterAddress, coin, isTestnet);
  if (!position) {
    throw inputError(`No open position found for ${coin}.`);
  }

  const currentAbs = Math.abs(Number(position.szi));
  const requested = parsed.flags?.size != null ? assertPositiveNumber(parsed.flags.size, 'size') : currentAbs;
  const closeSize = Math.min(currentAbs, requested);
  const side = Number(position.szi) > 0 ? 'sell' : 'buy';

  if (parsed.flags?.['limit-price'] != null) {
    const limitPrice = assertPositiveNumber(parsed.flags['limit-price'], 'limit-price');
    const wirePrice = priceToWire(limitPrice);
    const wireSize = sizeToWire(closeSize, assetInfo.szDecimals);
    validateOrderWireValues({
      coin,
      sizeInput: closeSize,
      sizeWire: wireSize,
      szDecimals: assetInfo.szDecimals,
      priceWire: wirePrice,
    });

    const builderDecision = await resolveBuilderForOrder(account.masterAddress, isTestnet);
    const response = await deps.exchangeClient.placeOrder(
      {
        asset: assetInfo.asset,
        isBuy: side === 'buy',
        price: wirePrice,
        size: wireSize,
        reduceOnly: true,
        orderType: { limit: { tif: 'Gtc' } },
      },
      privateKey,
      account.agentAddress,
      {
        isTestnet,
        cloid: generateCloid(),
        ...(builderDecision.builder ? { builder: builderDecision.builder } : {}),
      },
    );
    const data = parseOrderResponse(response, coin, side, closeSize, limitPrice);
    const notices = [];
    if (builderDecision.notice) notices.push(builderDecision.notice);
    const warnings = [];
    if (builderDecision.warning) warnings.push(builderDecision.warning);
    const rejectionWarning = getOrderRejectionWarning(data);
    if (rejectionWarning) warnings.push(rejectionWarning);
    return {
      ok: true,
      type: 'close_result',
      data: {
        coin,
        mode: 'limit',
        side,
        size: closeSize,
        price: limitPrice,
        order: data,
      },
      ...(notices.length ? { notices } : {}),
      ...(warnings.length ? { warnings } : {}),
    };
  }

  const slippagePct = Number(parsed.flags?.slippage) || DEFAULT_SLIPPAGE_PCT;
  const marketResult = await placeIocMarketLikeOrder({
    account,
    privateKey,
    isTestnet,
    assetInfo,
    coin,
    side,
    size: closeSize,
    reduceOnly: true,
    slippagePct,
  });
  return {
    ok: true,
    type: 'close_result',
    data: {
      coin,
      mode: 'market',
      side,
      size: closeSize,
      order: marketResult.data,
    },
    ...(marketResult.notices.length ? { notices: marketResult.notices } : {}),
    warnings: marketResult.warnings,
  };
}

async function reversePosition(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  if (marketType === 'spot') {
    throw inputError('reverse-position is only supported for perp/hip3 positions.');
  }
  const coin = assertCoin(parsed.target);
  validateNamespaceCoinPair(coin, marketType);

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithNamespace(coin, marketType, isTestnet);
  const position = await getPositionForCoin(account.masterAddress, coin, isTestnet);
  if (!position) {
    throw inputError(`No open position found for ${coin}.`);
  }

  const currentAbs = Math.abs(Number(position.szi));
  const extra = parsed.flags?.size != null ? assertPositiveNumber(parsed.flags.size, 'size') : currentAbs;
  const reverseSize = currentAbs + extra;
  const side = Number(position.szi) > 0 ? 'sell' : 'buy';
  const slippagePct = Number(parsed.flags?.slippage) || DEFAULT_SLIPPAGE_PCT;

  const marketResult = await placeIocMarketLikeOrder({
    account,
    privateKey,
    isTestnet,
    assetInfo,
    coin,
    side,
    size: reverseSize,
    reduceOnly: false,
    slippagePct,
  });

  return {
    ok: true,
    type: 'reverse_result',
    data: {
      coin,
      fromSide: Number(position.szi) > 0 ? 'long' : 'short',
      targetSide: Number(position.szi) > 0 ? 'short' : 'long',
      closeSize: currentAbs,
      openExtraSize: extra,
      order: marketResult.data,
    },
    ...(marketResult.notices.length ? { notices: marketResult.notices } : {}),
    warnings: marketResult.warnings,
  };
}

async function scaleOrder(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  const side = assertSide(parsed.args?.side);
  const coin = assertCoin(parsed.target);
  validateNamespaceCoinPair(coin, marketType);
  assertReduceOnlyAllowed(marketType, parsed.flags);

  const from = assertPositiveNumber(parsed.flags?.from, 'from');
  const to = assertPositiveNumber(parsed.flags?.to, 'to');
  const count = assertPositiveInteger(parsed.flags?.count, 'count');
  const totalSize = assertPositiveNumber(parsed.flags?.['total-size'], 'total-size');
  if (count < 2) throw inputError('count must be at least 2.');

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithNamespace(coin, marketType, isTestnet);
  const tif = parsed.flags?.tif ? assertTif(parsed.flags.tif) : 'Gtc';
  const reduceOnly = !!parsed.flags?.['reduce-only'];

  const step = (to - from) / (count - 1);
  const perOrderSize = totalSize / count;
  const orders = [];
  const levels = [];
  for (let i = 0; i < count; i++) {
    const price = from + step * i;
    const wirePrice = priceToWire(price);
    const wireSize = sizeToWire(perOrderSize, assetInfo.szDecimals);
    validateOrderWireValues({
      coin,
      sizeInput: perOrderSize,
      sizeWire: wireSize,
      szDecimals: assetInfo.szDecimals,
      priceWire: wirePrice,
    });
    orders.push({
      asset: assetInfo.asset,
      isBuy: side === 'buy',
      price: wirePrice,
      size: wireSize,
      reduceOnly,
      orderType: { limit: { tif } },
      cloid: generateCloid(),
    });
    levels.push({ price, size: perOrderSize });
  }

  const builderDecision = await resolveBuilderForOrder(account.masterAddress, isTestnet);
  const response = await deps.exchangeClient.placeOrders(
    orders,
    privateKey,
    account.agentAddress,
    {
      isTestnet,
      ...(builderDecision.builder ? { builder: builderDecision.builder } : {}),
    },
  );
  const statuses = response?.response?.data?.statuses || response?.data?.statuses || response?.statuses || [];
  const results = levels.map((level, idx) => {
    const st = statuses[idx];
    if (st?.resting) return { ...level, status: 'resting', oid: st.resting.oid };
    if (st?.filled) return { ...level, status: 'filled', oid: st.filled.oid };
    if (st?.error) return { ...level, status: 'error', error: st.error };
    if (typeof st === 'string') return { ...level, status: st.toLowerCase() === 'success' ? 'submitted' : 'unknown' };
    return { ...level, status: 'submitted' };
  });

  const notices = [];
  if (builderDecision.notice) notices.push(builderDecision.notice);
  const warnings = [];
  if (builderDecision.warning) warnings.push(builderDecision.warning);

  return {
    ok: true,
    type: 'scale_result',
    data: {
      coin,
      side,
      from,
      to,
      count,
      totalSize,
      submitted: results.filter((r) => r.status !== 'error').length,
      errors: results.filter((r) => r.status === 'error').length,
      levels: results,
    },
    ...(notices.length ? { notices } : {}),
    ...(warnings.length ? { warnings } : {}),
  };
}

async function tpsl(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  if (marketType === 'spot') {
    throw inputError('tpsl is only supported for perp/hip3 positions.');
  }
  const coin = assertCoin(parsed.target);
  validateNamespaceCoinPair(coin, marketType);
  const tpPrice = assertPositiveNumber(parsed.flags?.tp, 'tp');
  const slPrice = assertPositiveNumber(parsed.flags?.sl, 'sl');

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithNamespace(coin, marketType, isTestnet);
  const position = await getPositionForCoin(account.masterAddress, coin, isTestnet);
  if (!position) {
    throw inputError(`No open position found for ${coin}.`);
  }

  const currentAbs = Math.abs(Number(position.szi));
  const size = parsed.flags?.size != null ? assertPositiveNumber(parsed.flags.size, 'size') : currentAbs;
  const closeSize = Math.min(currentAbs, size);
  const exitIsBuy = Number(position.szi) < 0;
  const wireSize = sizeToWire(closeSize, assetInfo.szDecimals);
  validateWireSizeOnly({ coin, sizeInput: closeSize, sizeWire: wireSize, szDecimals: assetInfo.szDecimals });

  const orders = [
    {
      asset: assetInfo.asset,
      isBuy: exitIsBuy,
      price: priceToWire(tpPrice),
      size: wireSize,
      reduceOnly: true,
      orderType: { trigger: { isMarket: true, triggerPx: priceToWire(tpPrice), tpsl: 'tp' } },
      cloid: generateCloid(),
    },
    {
      asset: assetInfo.asset,
      isBuy: exitIsBuy,
      price: priceToWire(slPrice),
      size: wireSize,
      reduceOnly: true,
      orderType: { trigger: { isMarket: true, triggerPx: priceToWire(slPrice), tpsl: 'sl' } },
      cloid: generateCloid(),
    },
  ];

  const builderDecision = await resolveBuilderForOrder(account.masterAddress, isTestnet);
  const response = await deps.exchangeClient.placeOrders(
    orders,
    privateKey,
    account.agentAddress,
    {
      isTestnet,
      grouping: 'positionTpsl',
      ...(builderDecision.builder ? { builder: builderDecision.builder } : {}),
    },
  );
  const statuses = response?.response?.data?.statuses || response?.data?.statuses || response?.statuses || [];
  const okCount = statuses.filter((st) => !(st?.error)).length;

  const notices = [];
  if (builderDecision.notice) notices.push(builderDecision.notice);
  const warnings = [];
  if (builderDecision.warning) warnings.push(builderDecision.warning);

  return {
    ok: true,
    type: 'tpsl_result',
    data: {
      coin,
      side: Number(position.szi) > 0 ? 'long' : 'short',
      size: closeSize,
      tp: tpPrice,
      sl: slPrice,
      submitted: okCount,
      total: statuses.length || 2,
    },
    ...(notices.length ? { notices } : {}),
    ...(warnings.length ? { warnings } : {}),
  };
}

async function oto(parsed, ctx) {
  const marketType = assertMarketType(parsed);
  if (marketType === 'spot') {
    throw inputError('oto is only supported for perp/hip3 markets in this skill.');
  }
  const coin = assertCoin(parsed.target);
  validateNamespaceCoinPair(coin, marketType);
  const side = assertSide(parsed.args?.side);
  const size = assertPositiveNumber(parsed.args?.size, 'size');
  const entryPrice = assertPositiveNumber(parsed.args?.entryPrice, 'entryPrice');
  const tpPrice = assertPositiveNumber(parsed.flags?.tp, 'tp');
  const slPrice = assertPositiveNumber(parsed.flags?.sl, 'sl');

  const { account, privateKey, isTestnet } = getTradeContext(parsed, ctx);
  const assetInfo = await resolveAssetWithNamespace(coin, marketType, isTestnet);
  const wireSize = sizeToWire(size, assetInfo.szDecimals);
  validateWireSizeOnly({ coin, sizeInput: size, sizeWire: wireSize, szDecimals: assetInfo.szDecimals });

  const entryOrder = {
    asset: assetInfo.asset,
    isBuy: side === 'buy',
    price: priceToWire(entryPrice),
    size: wireSize,
    reduceOnly: false,
    orderType: { limit: { tif: 'Gtc' } },
    cloid: generateCloid(),
  };
  const exitIsBuy = side === 'sell';
  const tpOrder = {
    asset: assetInfo.asset,
    isBuy: exitIsBuy,
    price: priceToWire(tpPrice),
    size: wireSize,
    reduceOnly: true,
    orderType: { trigger: { isMarket: true, triggerPx: priceToWire(tpPrice), tpsl: 'tp' } },
    cloid: generateCloid(),
  };
  const slOrder = {
    asset: assetInfo.asset,
    isBuy: exitIsBuy,
    price: priceToWire(slPrice),
    size: wireSize,
    reduceOnly: true,
    orderType: { trigger: { isMarket: true, triggerPx: priceToWire(slPrice), tpsl: 'sl' } },
    cloid: generateCloid(),
  };

  const builderDecision = await resolveBuilderForOrder(account.masterAddress, isTestnet);
  const response = await deps.exchangeClient.placeOrders(
    [entryOrder, tpOrder, slOrder],
    privateKey,
    account.agentAddress,
    {
      isTestnet,
      grouping: 'normalTpsl',
      ...(builderDecision.builder ? { builder: builderDecision.builder } : {}),
    },
  );
  const statuses = response?.response?.data?.statuses || response?.data?.statuses || response?.statuses || [];

  const notices = [];
  if (builderDecision.notice) notices.push(builderDecision.notice);
  const warnings = [];
  if (builderDecision.warning) warnings.push(builderDecision.warning);

  return {
    ok: true,
    type: 'oto_result',
    data: {
      coin,
      side,
      size,
      entryPrice,
      tp: tpPrice,
      sl: slPrice,
      submitted: statuses.filter((st) => !(st?.error)).length,
      total: statuses.length || 3,
    },
    ...(notices.length ? { notices } : {}),
    ...(warnings.length ? { warnings } : {}),
  };
}

async function builderApproval(parsed, ctx) {
  const isTestnet = ctx?.network === 'testnet';
  const user = resolveBuilderApprovalUser(parsed);
  const builderAddress = resolveBuilderAddress(parsed);
  const maxBuilderFee = normalizeMaxBuilderFee(
    await deps.infoClient.getMaxBuilderFee(user, builderAddress, { isTestnet }),
  );
  const approved = maxBuilderFee > 0;
  const fee = approved ? Math.min(BUILDER_FEE, maxBuilderFee) : null;
  const notices = [];
  if (!approved) notices.push(BUILDER_NOT_APPROVED_MESSAGE);

  return {
    ok: true,
    type: 'builder-approval',
    data: {
      user,
      builderAddress,
      maxBuilderFee,
      approved,
      orderBuilder: approved ? { b: builderAddress, f: fee } : null,
    },
    ...(notices.length ? { notices } : {}),
  };
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
  builderApproval,
  limit, market, modify, twapCreate, twapCancel, batchLimit,
  cancel, cancelAll, cancelByCloid, cancelMultiple,
  closePosition, reversePosition, scaleOrder, tpsl, oto,
  setLeverage, topupIsolated, approveBuilder,
};
