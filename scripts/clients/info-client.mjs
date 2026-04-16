import { HttpTransport, InfoClient } from '@nktkas/hyperliquid';

const clientByNetwork = new Map();

function getClient(opts = {}) {
  const isTestnet = !!opts.isTestnet;
  const key = isTestnet ? 'testnet' : 'mainnet';
  if (!clientByNetwork.has(key)) {
    const transport = new HttpTransport({ isTestnet });
    clientByNetwork.set(key, new InfoClient({ transport }));
  }
  return clientByNetwork.get(key);
}

// --- all-dex-aware reads ---

export async function getAllMids(opts = {}) {
  const client = getClient(opts);
  const dex = opts.dex ?? '';
  return client.allMids({ dex });
}

export async function getAllPerpMetas(opts = {}) {
  const client = getClient(opts);
  return client.allPerpMetas();
}

export async function getAllDexsAssetCtxs(opts = {}) {
  const client = getClient(opts);
  const metas = await client.allPerpMetas();
  const ctxs = await Promise.all(
    metas.map((meta, dexIndex) => {
      const firstName = meta?.universe?.[0]?.name || '';
      const dex = dexIndex === 0 ? '' : (firstName.includes(':') ? firstName.split(':')[0] : firstName);
      return client.metaAndAssetCtxs({ dex });
    }),
  );
  return { metas, ctxs };
}

// --- backward-compatible wrappers ---

export async function getPerpMeta(opts = {}) {
  const client = getClient(opts);
  return client.meta();
}

export async function getSpotMeta(opts = {}) {
  const client = getClient(opts);
  return client.spotMeta();
}

export async function getSpotAssetCtxs(opts = {}) {
  const client = getClient(opts);
  const [, spotAssetCtxs] = await client.spotMetaAndAssetCtxs();
  return spotAssetCtxs;
}

export async function getMetaAndAssetCtxs(opts = {}) {
  const client = getClient(opts);
  const dex = opts.dex ?? '';
  return client.metaAndAssetCtxs({ dex });
}

export async function getSpotMetaAndAssetCtxs(opts = {}) {
  const client = getClient(opts);
  return client.spotMetaAndAssetCtxs();
}

export async function getL2Book(coin, nSigFigs, mantissa, opts = {}) {
  const client = getClient(opts);
  const req = { coin };
  if (nSigFigs != null) req.nSigFigs = nSigFigs;
  if (mantissa != null) req.mantissa = mantissa;
  return client.l2Book(req);
}

export async function getCandles(coin, interval, startTime, endTime, opts = {}) {
  const client = getClient(opts);
  return client.candleSnapshot({
    coin,
    interval,
    startTime,
    endTime: endTime || Date.now(),
  });
}

export async function getClearinghouseState(user, opts = {}) {
  const client = getClient(opts);
  const dex = opts.dex ?? '';
  return client.clearinghouseState({ user, dex });
}

export async function getSpotClearinghouseState(user, opts = {}) {
  const client = getClient(opts);
  return client.spotClearinghouseState({ user });
}

export async function getOpenOrders(user, opts = {}) {
  const client = getClient(opts);
  const dex = opts.dex ?? 'ALL_DEXS';
  return client.openOrders({ user, dex });
}

export async function getFrontendOpenOrders(user, opts = {}) {
  const client = getClient(opts);
  const dex = opts.dex ?? 'ALL_DEXS';
  return client.frontendOpenOrders({ user, dex });
}

export async function getUserFills(user, aggregateByTime = false, opts = {}) {
  const client = getClient(opts);
  return client.userFills({ user, aggregateByTime });
}

export async function getUserFillsByTime(user, startTime, endTime, aggregateByTime = false, opts = {}) {
  const client = getClient(opts);
  return client.userFillsByTime({ user, startTime, endTime, aggregateByTime });
}

export async function getHistoricalOrders(user, opts = {}) {
  const client = getClient(opts);
  return client.historicalOrders({ user });
}

export async function getUserFunding(user, startTime = null, endTime = null, opts = {}) {
  const client = getClient(opts);
  return client.userFunding({ user, startTime, endTime });
}

export async function getTwapHistory(user, opts = {}) {
  const client = getClient(opts);
  return client.twapHistory({ user });
}

export async function getUserTwapSliceFills(user, opts = {}) {
  const client = getClient(opts);
  return client.userTwapSliceFills({ user });
}

export async function getUserRole(user, opts = {}) {
  const client = getClient(opts);
  return client.userRole({ user });
}

export async function getMaxBuilderFee(user, builder, opts = {}) {
  const client = getClient(opts);
  return client.maxBuilderFee({ user, builder });
}
