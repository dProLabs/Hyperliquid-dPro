import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertAddress, assertPrivateKey, assertCoin, assertPositiveNumber, assertPositiveInteger, assertSide, assertTif } from '../utils/validate.mjs';

describe('validation', () => {
  describe('assertAddress', () => {
    it('accepts valid address', () => {
      assert.equal(assertAddress('0x1234567890abcdef1234567890abcdef12345678'), '0x1234567890abcdef1234567890abcdef12345678');
    });
    it('rejects short address', () => {
      assert.throws(() => assertAddress('0x1234'));
    });
    it('rejects missing 0x', () => {
      assert.throws(() => assertAddress('1234567890abcdef1234567890abcdef12345678'));
    });
  });

  describe('assertPrivateKey', () => {
    it('accepts 64 hex chars', () => {
      const key = 'a'.repeat(64);
      assert.equal(assertPrivateKey(key), key);
    });
    it('accepts 0x-prefixed', () => {
      const key = '0x' + 'b'.repeat(64);
      assert.equal(assertPrivateKey(key), 'b'.repeat(64));
    });
    it('rejects invalid', () => {
      assert.throws(() => assertPrivateKey('short'));
    });
  });

  describe('assertCoin', () => {
    it('normalizes to uppercase', () => {
      assert.equal(assertCoin('btc'), 'BTC');
    });
    it('accepts namespaced coin', () => {
      assert.equal(assertCoin('xyz:aapl'), 'XYZ:AAPL');
      assert.equal(assertCoin('flx:TSLA'), 'FLX:TSLA');
    });
    it('rejects empty', () => {
      assert.throws(() => assertCoin(''));
    });
    it('rejects malformed namespace', () => {
      assert.throws(() => assertCoin('xyz:'));
      assert.throws(() => assertCoin(':AAPL'));
      assert.throws(() => assertCoin('x:y:z'));
    });
  });

  describe('assertPositiveNumber', () => {
    it('accepts positive', () => {
      assert.equal(assertPositiveNumber('1.5'), 1.5);
    });
    it('rejects zero', () => {
      assert.throws(() => assertPositiveNumber('0'));
    });
    it('rejects negative', () => {
      assert.throws(() => assertPositiveNumber('-1'));
    });
    it('rejects non-number', () => {
      assert.throws(() => assertPositiveNumber('abc'));
    });
  });

  describe('assertPositiveInteger', () => {
    it('accepts positive integer', () => {
      assert.equal(assertPositiveInteger('10'), 10);
    });
    it('rejects float', () => {
      assert.throws(() => assertPositiveInteger('1.5'));
    });
  });

  describe('assertSide', () => {
    it('normalizes buy', () => {
      assert.equal(assertSide('BUY'), 'buy');
    });
    it('rejects invalid', () => {
      assert.throws(() => assertSide('hold'));
    });
  });

  describe('assertTif', () => {
    it('normalizes gtc', () => {
      assert.equal(assertTif('gtc'), 'Gtc');
    });
    it('normalizes IOC', () => {
      assert.equal(assertTif('IOC'), 'Ioc');
    });
    it('rejects invalid', () => {
      assert.throws(() => assertTif('fok'));
    });
  });
});
