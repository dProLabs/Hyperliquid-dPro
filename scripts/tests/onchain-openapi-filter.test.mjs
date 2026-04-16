import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAllowedOnchainGetPaths } from '../clients/onchain-client.mjs';

describe('onchain openapi filter', () => {
  it('includes expected GET endpoints', async () => {
    const allowlist = await getAllowedOnchainGetPaths();
    assert.equal(allowlist.has('/api/v1/health'), true);
    assert.equal(allowlist.has('/api/v1/hl/prices/mids'), true);
    assert.equal(allowlist.has('/api/v1/hl/orders/book'), true);
    assert.equal(allowlist.has('/api/v1/hl/trending'), true);
    assert.equal(allowlist.has('/api/v1/leaderboard'), true);
    assert.equal(allowlist.has('/api/v1/hip3/fills'), true);
  });

  it('excludes blocked endpoints', async () => {
    const allowlist = await getAllowedOnchainGetPaths();
    assert.equal(allowlist.has('/api/v1/news'), false);
    assert.equal(allowlist.has('/api/v1/asset-data/news'), false);
    assert.equal(allowlist.has('/api/v1/referral/status'), false);
    assert.equal(allowlist.has('/api/v1/claimable_balance'), false);
  });
});
