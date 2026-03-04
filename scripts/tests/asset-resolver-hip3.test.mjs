import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __setAssetCachesForTest, resolveAsset, resetCache } from '../resolvers/asset-resolver.mjs';

describe('asset-resolver HIP-3 strict matching', () => {
  it('resolves xyz:AAPL and AAPL independently', async () => {
    __setAssetCachesForTest({
      perps: [{ coin: 'XYZ:AAPL', asset: 110000, kind: 'perp', szDecimals: 2 }],
      spots: [{ coin: 'AAPL', asset: 10268, kind: 'spot' }],
    });

    const spot = await resolveAsset('AAPL');
    const perp = await resolveAsset('xyz:aapl');

    assert.equal(spot.asset, 10268);
    assert.equal(spot.kind, 'spot');
    assert.equal(perp.asset, 110000);
    assert.equal(perp.kind, 'perp');
  });

  it('does not auto-map between bare and namespaced symbols', async () => {
    __setAssetCachesForTest({
      perps: [{ coin: 'FLX:TSLA', asset: 120001, kind: 'perp', szDecimals: 2 }],
      spots: [],
    });
    await assert.rejects(() => resolveAsset('TSLA'), /Asset not found: TSLA/i);
  });

  it('reset cache helper works', () => {
    resetCache();
    assert.ok(true);
  });
});
