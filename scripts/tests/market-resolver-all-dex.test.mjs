import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  refreshMarkets,
  getAllMarkets,
  findMarket,
  resetCache,
  __setMarketFetchersForTest,
  __resetMarketFetchersForTest,
} from '../resolvers/market-resolver.mjs';

describe('market-resolver all-dex indexing', () => {
  afterEach(() => {
    resetCache();
    __resetMarketFetchersForTest();
  });

  it('computes main perp / hip-3 perp / spot asset ids correctly', async () => {
    const allPerpMetas = [
      { universe: [{ name: 'BTC', szDecimals: 3, maxLeverage: 40 }] },
      { universe: [{ name: 'XYZ:AAPL', szDecimals: 2, maxLeverage: 5 }] },
    ];

    __setMarketFetchersForTest({
      getAllPerpMetas: async () => allPerpMetas,
      getMetaAndAssetCtxs: async ({ dex }) => {
        if (!dex) return [allPerpMetas[0], [{ markPx: '90000', prevDayPx: '88000' }]];
        return [allPerpMetas[1], [{ markPx: '260', prevDayPx: '255' }]];
      },
      getSpotMeta: async () => ({
        tokens: [{ index: 0, name: 'AAPL' }, { index: 1, name: 'USDC' }],
        universe: [{ name: '@10268', tokens: [0, 1], index: 268 }],
      }),
      getSpotAssetCtxs: async () => [{ coin: '@10268', markPx: '263.8', prevDayPx: '265.0' }],
    });

    await refreshMarkets();

    const btc = await findMarket('BTC');
    const xyzAapl = await findMarket('xyz:AAPL');
    const spotAapl = await findMarket('AAPL');
    const all = await getAllMarkets();

    assert.equal(btc.assetId, 0);
    assert.equal(xyzAapl.assetId, 110000); // 100000 + 1*10000 + 0
    assert.equal(spotAapl.assetId, 10268); // 10000 + 268
    assert.equal(all.length, 3);
  });
});

