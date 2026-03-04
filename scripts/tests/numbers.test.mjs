import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { floatToWire, priceToWire, sizeToWire } from '../utils/numbers.mjs';

describe('floatToWire', () => {
  it('handles integers', () => {
    assert.equal(floatToWire(50000), '50000');
  });

  it('handles decimals', () => {
    assert.equal(floatToWire(0.001), '0.001');
  });

  it('strips trailing zeros', () => {
    assert.equal(floatToWire(1.50), '1.5');
  });

  it('handles small numbers', () => {
    assert.equal(floatToWire(0.00000001), '0.00000001');
  });

  it('handles string input', () => {
    assert.equal(floatToWire('123.456'), '123.456');
  });

  it('throws on NaN', () => {
    assert.throws(() => floatToWire('abc'));
  });
});

describe('priceToWire', () => {
  it('rounds to 5 significant figures without tick', () => {
    assert.equal(priceToWire(50123.456), '50123');
  });

  it('rounds market-like protection price to 5 significant figures', () => {
    assert.equal(priceToWire(73029.433), '73029');
  });

  it('rounds to tick size', () => {
    assert.equal(priceToWire(50123.456, 0.1), '50123.5');
  });
});

describe('sizeToWire', () => {
  it('rounds to szDecimals', () => {
    assert.equal(sizeToWire(0.123456, 3), '0.123');
  });

  it('handles 0 decimals', () => {
    assert.equal(sizeToWire(1.7, 0), '2');
  });
});
