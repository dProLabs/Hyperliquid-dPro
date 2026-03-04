import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAsset, resetCache as resetAssetCache } from '../resolvers/asset-resolver.mjs';
import { __setMarketCachesForTest, resetCache as resetMarketCache } from '../resolvers/market-resolver.mjs';

describe('asset-resolver all-dex', () => {
  afterEach(() => {
    resetAssetCache();
    resetMarketCache();
  });

  it('resolves same ticker across dex namespaces independently', async () => {
    __setMarketCachesForTest({
      perps: [
        { coin: 'FLX:TSLA', type: 'perp', assetId: 120001, dexIndex: 2, dexName: 'FLX', marketIndex: 1, szDecimals: 2 },
        { coin: 'VNTL:TSLA', type: 'perp', assetId: 130005, dexIndex: 3, dexName: 'VNTL', marketIndex: 5, szDecimals: 2 },
      ],
      spots: [
        { coin: 'TSLA', type: 'spot', assetId: 10123, marketIndex: 123, apiName: '@10123' },
      ],
    });

    const flx = await resolveAsset('flx:tsla');
    const vntl = await resolveAsset('vntl:TSLA');
    const spot = await resolveAsset('TSLA');

    assert.equal(flx.asset, 120001);
    assert.equal(vntl.asset, 130005);
    assert.equal(spot.asset, 10123);
    assert.equal(flx.dexName, 'FLX');
    assert.equal(vntl.dexName, 'VNTL');
  });
});

