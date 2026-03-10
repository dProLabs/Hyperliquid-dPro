import { ExchangeClient, HttpTransport } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';
import { apiRejected, networkError } from '../errors.mjs';
import { MAINNET_URL, TESTNET_URL } from '../constants.mjs';

function normalizePrivateKey(privateKeyHex) {
  if (!privateKeyHex) return privateKeyHex;
  return privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`;
}

function classifyAndWrapError(err, context) {
  const message = err?.message || 'Unknown exchange error';
  const lc = message.toLowerCase();
  if (lc.includes('network') || lc.includes('fetch') || lc.includes('timeout') || lc.includes('ecconn') || lc.includes('enotfound')) {
    return networkError(`${context}: ${message}`, { cause: err?.cause || message });
  }
  return apiRejected(`${context}: ${message}`, { cause: err?.cause || message });
}

function createExchangeClient(privateKeyHex, opts = {}) {
  const { isTestnet = false } = opts;
  const wallet = privateKeyToAccount(normalizePrivateKey(privateKeyHex));
  const transport = new HttpTransport({ isTestnet, apiUrl: isTestnet ? TESTNET_URL : MAINNET_URL });
  return new ExchangeClient({ transport, wallet });
}

let exchangeClientFactory = createExchangeClient;

// Test-only injection point for SDK client behavior.
export function __setExchangeClientFactoryForTest(factory) {
  exchangeClientFactory = factory || createExchangeClient;
}

export function __resetExchangeClientFactoryForTest() {
  exchangeClientFactory = createExchangeClient;
}

export async function placeOrder(orderSpec, privateKeyHex, _agentAddress, opts = {}) {
  const { isTestnet = false, cloid } = opts;
  const exchange = exchangeClientFactory(privateKeyHex, { isTestnet });
  const order = {
    a: orderSpec.asset,
    b: orderSpec.isBuy,
    p: orderSpec.price,
    s: orderSpec.size,
    r: orderSpec.reduceOnly || false,
    t: orderSpec.orderType,
  };
  if (cloid) order.c = cloid;
  try {
    return await exchange.order({
      orders: [order],
      grouping: 'na',
    });
  } catch (err) {
    throw classifyAndWrapError(err, 'Order rejected');
  }
}

export async function cancelOrders(cancels, privateKeyHex, _agentAddress, opts = {}) {
  const { isTestnet = false } = opts;
  const exchange = exchangeClientFactory(privateKeyHex, { isTestnet });
  try {
    return await exchange.cancel({
      cancels: cancels.map((c) => ({
        a: c.asset,
        o: c.oid,
      })),
    });
  } catch (err) {
    throw classifyAndWrapError(err, 'Cancel rejected');
  }
}

export async function cancelByCloid(asset, cloid, privateKeyHex, _agentAddress, opts = {}) {
  const { isTestnet = false } = opts;
  const exchange = exchangeClientFactory(privateKeyHex, { isTestnet });
  try {
    return await exchange.cancelByCloid({ cancels: [{ asset, cloid }] });
  } catch (err) {
    throw classifyAndWrapError(err, 'Cancel by cloid rejected');
  }
}

export async function updateLeverage(asset, isCross, leverage, privateKeyHex, _agentAddress, opts = {}) {
  const { isTestnet = false } = opts;
  const exchange = exchangeClientFactory(privateKeyHex, { isTestnet });
  try {
    return await exchange.updateLeverage({ asset, isCross, leverage });
  } catch (err) {
    throw classifyAndWrapError(err, 'Update leverage rejected');
  }
}

export async function updateIsolatedMargin(asset, isBuy, ntli, privateKeyHex, _agentAddress, opts = {}) {
  const { isTestnet = false } = opts;
  const exchange = exchangeClientFactory(privateKeyHex, { isTestnet });
  try {
    return await exchange.updateIsolatedMargin({ asset, isBuy, ntli });
  } catch (err) {
    throw classifyAndWrapError(err, 'Update isolated margin rejected');
  }
}

export async function approveBuilderFee(maxFeeRate, builder, privateKeyHex, _agentAddress, opts = {}) {
  const { isTestnet = false } = opts;
  const exchange = exchangeClientFactory(privateKeyHex, { isTestnet });
  try {
    return await exchange.approveBuilderFee({ maxFeeRate, builder });
  } catch (err) {
    throw classifyAndWrapError(err, 'Approve builder fee rejected');
  }
}

export async function usdClassTransfer(amount, toPerp, privateKeyHex, _userAddress, opts = {}) {
  const { isTestnet = false } = opts;
  const exchange = exchangeClientFactory(privateKeyHex, { isTestnet });
  try {
    return await exchange.usdClassTransfer({ amount, toPerp });
  } catch (err) {
    throw classifyAndWrapError(err, 'USD class transfer rejected');
  }
}
