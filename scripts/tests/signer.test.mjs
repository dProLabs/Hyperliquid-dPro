import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashAction, signL1Action, signApproveBuilderFee, privateKeyToAddress } from '../clients/signer.mjs';

// Well-known test private key (Hardhat account #0)
const TEST_KEY = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const EXPECTED_ADDRESS = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

describe('signer', () => {
  describe('privateKeyToAddress', () => {
    it('derives correct address from known key', () => {
      const addr = privateKeyToAddress(TEST_KEY);
      assert.equal(addr, EXPECTED_ADDRESS);
    });

    it('handles 0x prefix', () => {
      const addr = privateKeyToAddress('0x' + TEST_KEY);
      assert.equal(addr, EXPECTED_ADDRESS);
    });
  });

  describe('hashAction', () => {
    it('produces 32-byte hash', () => {
      const action = { type: 'order', orders: [], grouping: 'na' };
      const hash = hashAction(action, 1000);
      assert.equal(hash.length, 32);
    });

    it('produces different hashes for different nonces', () => {
      const action = { type: 'order', orders: [], grouping: 'na' };
      const h1 = hashAction(action, 1000);
      const h2 = hashAction(action, 1001);
      assert.notDeepEqual(h1, h2);
    });

    it('produces different hashes for different actions', () => {
      const a1 = { type: 'order', orders: [{ a: 0 }], grouping: 'na' };
      const a2 = { type: 'order', orders: [{ a: 1 }], grouping: 'na' };
      const h1 = hashAction(a1, 1000);
      const h2 = hashAction(a2, 1000);
      assert.notDeepEqual(h1, h2);
    });
  });

  describe('signL1Action', () => {
    it('returns valid signature with r, s, v', () => {
      const action = {
        type: 'order',
        orders: [{
          a: 0, b: true, p: '50000', s: '0.01',
          r: false, t: { limit: { tif: 'Gtc' } },
        }],
        grouping: 'na',
      };
      const sig = signL1Action(TEST_KEY, action, 1700000000000);
      assert.ok(sig.r.startsWith('0x'));
      assert.ok(sig.s.startsWith('0x'));
      assert.equal(sig.r.length, 66); // 0x + 64 hex chars
      assert.equal(sig.s.length, 66);
      assert.ok(sig.v === 27 || sig.v === 28);
    });

    it('produces deterministic signatures for same input', () => {
      const action = { type: 'order', orders: [], grouping: 'na' };
      const s1 = signL1Action(TEST_KEY, action, 1000);
      const s2 = signL1Action(TEST_KEY, action, 1000);
      assert.equal(s1.r, s2.r);
      assert.equal(s1.s, s2.s);
      assert.equal(s1.v, s2.v);
    });

    it('produces different signatures for mainnet vs testnet', () => {
      const action = { type: 'order', orders: [], grouping: 'na' };
      const s1 = signL1Action(TEST_KEY, action, 1000, undefined, false);
      const s2 = signL1Action(TEST_KEY, action, 1000, undefined, true);
      assert.notEqual(s1.r, s2.r);
    });
  });

  describe('signApproveBuilderFee', () => {
    it('returns valid signature', () => {
      const sig = signApproveBuilderFee(
        TEST_KEY, 'Mainnet', '10', '0x0000000000000000000000000000000000000000', 1000
      );
      assert.ok(sig.r.startsWith('0x'));
      assert.ok(sig.s.startsWith('0x'));
      assert.ok(sig.v === 27 || sig.v === 28);
    });
  });
});
