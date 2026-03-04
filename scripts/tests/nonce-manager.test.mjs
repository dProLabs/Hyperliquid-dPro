import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nextNonce, fastForwardNonce, getLastNonce } from '../clients/nonce-manager.mjs';

describe('nonce-manager', () => {
  it('returns monotonically increasing nonces', () => {
    const addr = '0xtest_nonce_1';
    const n1 = nextNonce(addr);
    const n2 = nextNonce(addr);
    const n3 = nextNonce(addr);
    assert.ok(n2 > n1, `n2 (${n2}) should be > n1 (${n1})`);
    assert.ok(n3 > n2, `n3 (${n3}) should be > n2 (${n2})`);
  });

  it('uses independent nonces per signer', () => {
    const a1 = '0xsigner_a';
    const a2 = '0xsigner_b';
    const n1 = nextNonce(a1);
    const n2 = nextNonce(a2);
    // Both should be close to Date.now() but independent
    assert.ok(Math.abs(n1 - n2) < 100);
  });

  it('fast-forwards nonce', () => {
    const addr = '0xtest_ff';
    const n1 = nextNonce(addr);
    // Simulate time passing
    const ff = fastForwardNonce(addr);
    assert.ok(ff >= n1);
    const n2 = nextNonce(addr);
    assert.ok(n2 > ff);
  });

  it('tracks last nonce', () => {
    const addr = '0xtest_last';
    nextNonce(addr);
    const last = getLastNonce(addr);
    assert.ok(last > 0);
  });
});
