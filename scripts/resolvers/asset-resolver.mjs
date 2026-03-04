import { getAllMarkets } from './market-resolver.mjs';
import { assetNotFound } from '../errors.mjs';
let testPerpAssets = null;
let testSpotAssets = null;

/**
 * Resolve coin name to asset info.
 * @param {string} coin - e.g. "BTC", "ETH"
 * @param {string} [marketTypeHint] - "perp" or "spot", defaults to perp
 * @param {{ isTestnet?: boolean }} [opts]
 * @returns {{ asset: number, coin: string, kind: string, szDecimals?: number }}
 */
export async function resolveAsset(coin, marketTypeHint = 'perp', opts = {}) {
  const upper = coin.toUpperCase();

  // Test-only seeded cache path
  if (testPerpAssets || testSpotAssets) {
    const perp = testPerpAssets?.get(upper);
    const spot = testSpotAssets?.get(upper);
    if (marketTypeHint === 'spot' && spot) return spot;
    if (perp) return perp;
    if (spot) return spot;
    throw assetNotFound(coin);
  }

  const markets = await getAllMarkets(opts);
  const toInfo = (m) => ({
    asset: m.assetId,
    coin: m.coin,
    kind: m.type,
    apiName: m.apiName,
    szDecimals: m.szDecimals,
    maxLeverage: m.maxLeverage,
    dexIndex: m.dexIndex,
    dexName: m.dexName,
    marketIndex: m.marketIndex,
  });

  if (marketTypeHint === 'spot') {
    const spot = markets.find((m) => m.type === 'spot' && m.coin.toUpperCase() === upper);
    if (spot) return toInfo(spot);
  }

  // Default: try perp first
  const perp = markets.find((m) => m.type === 'perp' && m.coin.toUpperCase() === upper);
  if (perp) return toInfo(perp);

  // Fallback to spot
  const spot = markets.find((m) => m.type === 'spot' && m.coin.toUpperCase() === upper);
  if (spot) return toInfo(spot);

  throw assetNotFound(coin);
}

export async function resolveAssetId(coin, marketTypeHint = 'perp', opts = {}) {
  const info = await resolveAsset(coin, marketTypeHint, opts);
  return info.asset;
}

export function resetCache() {
  testPerpAssets = null;
  testSpotAssets = null;
}

// Test-only hook: seed asset caches without network calls.
export function __setAssetCachesForTest({ perps = [], spots = [] } = {}) {
  testPerpAssets = new Map();
  testSpotAssets = new Map();
  for (const p of perps) {
    testPerpAssets.set(String(p.coin).toUpperCase(), p);
  }
  for (const s of spots) {
    testSpotAssets.set(String(s.coin).toUpperCase(), s);
  }
}
