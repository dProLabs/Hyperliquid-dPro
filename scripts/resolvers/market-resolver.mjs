import {
  getAllPerpMetas,
  getMetaAndAssetCtxs,
  getSpotMeta,
  getSpotAssetCtxs,
} from '../clients/info-client.mjs';
import { ASSET_CACHE_TTL_MS } from '../constants.mjs';

const marketFetchers = {
  getAllPerpMetas,
  getMetaAndAssetCtxs,
  getSpotMeta,
  getSpotAssetCtxs,
};

const cacheByNetwork = new Map();

function getKey(opts = {}) {
  return opts.isTestnet ? 'testnet' : 'mainnet';
}

function getState(opts = {}) {
  const key = getKey(opts);
  if (!cacheByNetwork.has(key)) {
    cacheByNetwork.set(key, {
      perpCache: null,
      spotCache: null,
      lastFetchTime: 0,
    });
  }
  return cacheByNetwork.get(key);
}

function isCacheValid(opts = {}) {
  const state = getState(opts);
  return Date.now() - state.lastFetchTime < ASSET_CACHE_TTL_MS && state.perpCache && state.spotCache;
}

function inferDexName(meta, dexIndex) {
  if (dexIndex === 0) return '';
  const firstName = meta?.universe?.[0]?.name || '';
  if (!firstName) return '';
  return firstName.includes(':') ? firstName.split(':')[0] : firstName;
}

export async function refreshMarkets(opts = {}) {
  const state = getState(opts);
  const [allPerpMetas, spotMeta, spotCtxs] = await Promise.all([
    marketFetchers.getAllPerpMetas(opts),
    marketFetchers.getSpotMeta(opts),
    marketFetchers.getSpotAssetCtxs(opts),
  ]);

  const perpCtxByDex = await Promise.all(
    allPerpMetas.map((meta, dexIndex) => {
      const dex = inferDexName(meta, dexIndex);
      return marketFetchers.getMetaAndAssetCtxs({ ...opts, dex });
    }),
  );

  state.perpCache = [];
  for (let dexIndex = 0; dexIndex < allPerpMetas.length; dexIndex++) {
    const meta = allPerpMetas[dexIndex];
    const ctxs = perpCtxByDex[dexIndex]?.[1] || [];
    const dexName = inferDexName(meta, dexIndex);

    (meta.universe || []).forEach((m, marketIndex) => {
      const assetId = dexIndex === 0 ? marketIndex : 100000 + dexIndex * 10000 + marketIndex;
      state.perpCache.push({
        coin: m.name,
        type: 'perp',
        assetId,
        dexIndex,
        dexName,
        marketIndex,
        szDecimals: m.szDecimals,
        maxLeverage: m.maxLeverage,
        onlyIsolated: m.onlyIsolated || false,
        ctx: ctxs[marketIndex] || {},
      });
    });
  }

  // Build token index map for resolving @N market names to human-readable names
  const tokenMap = {};
  (spotMeta.tokens || []).forEach((t, i) => {
    const idx = t?.index ?? i;
    tokenMap[idx] = t;
  });

  state.spotCache = (spotMeta.universe || []).map((m, i) => {
    // Markets named @N: resolve base token name from spotMeta.tokens
    let displayName = m.name;
    if (m.name.startsWith('@') && m.tokens && m.tokens.length > 0) {
      const baseToken = tokenMap[m.tokens[0]];
      if (baseToken) displayName = baseToken.name;
    }
    const spotIndex = m.index ?? i;
    const spotCtx = (spotCtxs || []).find((c) => c.coin === m.name) || null;
    return {
      coin: displayName,
      apiName: m.name, // @N key used in API calls (allMids, l2Book, candles)
      type: 'spot',
      assetId: 10000 + spotIndex,
      dexIndex: null,
      dexName: null,
      marketIndex: spotIndex,
      tokens: m.tokens,
      ctx: spotCtx || {},
    };
  });

  state.lastFetchTime = Date.now();
}

async function ensureCache(opts = {}) {
  if (!isCacheValid(opts)) await refreshMarkets(opts);
}

export async function getAllMarkets(opts = {}) {
  await ensureCache(opts);
  const state = getState(opts);
  return [...state.perpCache, ...state.spotCache];
}

export async function getPerpMarkets(opts = {}) {
  await ensureCache(opts);
  return getState(opts).perpCache;
}

export async function getSpotMarkets(opts = {}) {
  await ensureCache(opts);
  return getState(opts).spotCache;
}

export async function findMarket(coin, opts = {}) {
  await ensureCache(opts);
  const state = getState(opts);
  const upper = coin.toUpperCase();
  // Try perp first
  const perp = state.perpCache.find(m => m.coin.toUpperCase() === upper);
  if (perp) return perp;
  // Then spot by display name or @N apiName
  const spot = state.spotCache.find(
    m => m.coin.toUpperCase() === upper || m.apiName?.toUpperCase() === upper
  );
  return spot || null;
}

export async function findPerpMarket(coin, opts = {}) {
  await ensureCache(opts);
  return getState(opts).perpCache.find(m => m.coin.toUpperCase() === coin.toUpperCase()) || null;
}

export async function findRelatedSymbols(coin, limit = 5, opts = {}) {
  await ensureCache(opts);
  const state = getState(opts);
  const upper = String(coin || '').toUpperCase();
  const ticker = upper.includes(':') ? upper.split(':').slice(-1)[0] : upper;
  const candidates = [...state.perpCache, ...state.spotCache]
    .map(m => m.coin.toUpperCase())
    .filter(s => s === ticker || s.endsWith(`:${ticker}`));
  return [...new Set(candidates)].slice(0, limit);
}

// Test-only hook: seed market caches without network calls.
export function __setMarketCachesForTest({ perps = [], spots = [], isTestnet = false } = {}) {
  const state = getState({ isTestnet });
  state.perpCache = perps;
  state.spotCache = spots;
  state.lastFetchTime = Date.now();
}

export function resetCache() {
  cacheByNetwork.clear();
}

// Test-only hook: replace market fetchers to avoid network.
export function __setMarketFetchersForTest(overrides = {}) {
  if (overrides.getAllPerpMetas) marketFetchers.getAllPerpMetas = overrides.getAllPerpMetas;
  if (overrides.getMetaAndAssetCtxs) marketFetchers.getMetaAndAssetCtxs = overrides.getMetaAndAssetCtxs;
  if (overrides.getSpotMeta) marketFetchers.getSpotMeta = overrides.getSpotMeta;
  if (overrides.getSpotAssetCtxs) marketFetchers.getSpotAssetCtxs = overrides.getSpotAssetCtxs;
}

export function __resetMarketFetchersForTest() {
  marketFetchers.getAllPerpMetas = getAllPerpMetas;
  marketFetchers.getMetaAndAssetCtxs = getMetaAndAssetCtxs;
  marketFetchers.getSpotMeta = getSpotMeta;
  marketFetchers.getSpotAssetCtxs = getSpotAssetCtxs;
}
