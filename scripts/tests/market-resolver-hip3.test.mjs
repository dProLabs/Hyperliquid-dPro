import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __setMarketCachesForTest, findMarket, findRelatedSymbols, resetCache } from '../resolvers/market-resolver.mjs';

describe('market-resolver HIP-3 strict matching', () => {
  it('treats AAPL and xyz:AAPL as distinct symbols', async () => {
    __setMarketCachesForTest({
      perps: [
        { coin: 'XYZ:AAPL', type: 'perp', assetId: 110000, dexIndex: 1, dexName: 'XYZ', marketIndex: 0 },
      ],
      spots: [
        { coin: 'AAPL', apiName: '@10268', type: 'spot', assetId: 10268 },
      ],
    });

    const spot = await findMarket('AAPL');
    const perp = await findMarket('xyz:AAPL');

    assert.equal(spot?.type, 'spot');
    assert.equal(spot?.coin, 'AAPL');
    assert.equal(perp?.type, 'perp');
    assert.equal(perp?.coin, 'XYZ:AAPL');
    assert.equal(perp?.dexIndex, 1);
  });

  it('returns related symbols without automatic fallback', async () => {
    __setMarketCachesForTest({
      perps: [{ coin: 'FLX:TSLA', type: 'perp', assetId: 120001 }],
      spots: [{ coin: 'TSLA', apiName: '@123', type: 'spot', assetId: 10123 }],
    });
    const related = await findRelatedSymbols('xyz:tsla');
    assert.deepEqual(related, ['FLX:TSLA', 'TSLA']);
    const direct = await findMarket('xyz:tsla');
    assert.equal(direct, null);
  });

  it('resets cache', async () => {
    resetCache();
    // no throw is enough; network path is intentionally not exercised in this unit test
    assert.ok(true);
  });
});
