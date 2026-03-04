import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __parseOrderResponseForTest, __validateOrderWireValuesForTest } from '../commands/trade.mjs';

describe('trade parseOrderResponse', () => {
  it('parses resting status from legacy shape', () => {
    const res = {
      response: {
        data: {
          statuses: [{ resting: { oid: 12345 } }],
        },
      },
    };
    const out = __parseOrderResponseForTest(res, 'BTC', 'buy', '0.01', '50000');
    assert.equal(out.status, 'resting');
    assert.equal(out.oid, 12345);
    assert.equal(out.coin, 'BTC');
  });

  it('parses filled status from SDK-like shape', () => {
    const res = {
      data: {
        statuses: [{ filled: { oid: 9, avgPx: '100', totalSz: '0.5' } }],
      },
    };
    const out = __parseOrderResponseForTest(res, 'ETH', 'sell', '0.5', '100');
    assert.equal(out.status, 'filled');
    assert.equal(out.oid, 9);
    assert.equal(out.avgPx, '100');
    assert.equal(out.totalSz, '0.5');
  });

  it('maps string success status to submitted', () => {
    const res = { statuses: ['success'] };
    const out = __parseOrderResponseForTest(res, 'SOL', 'buy', '1', '200');
    assert.equal(out.status, 'submitted');
  });

  it('parses error from statuses error object', () => {
    const res = {
      statuses: [{ error: 'Insufficient margin' }],
    };
    const out = __parseOrderResponseForTest(res, 'BTC', 'buy', '1', '1');
    assert.equal(out.status, 'error');
    assert.equal(out.error, 'Insufficient margin');
  });

  it('parses top-level error response', () => {
    const res = { status: 'err', response: 'bad request' };
    const out = __parseOrderResponseForTest(res, 'BTC', 'buy', '1', '1');
    assert.equal(out.status, 'error');
    assert.equal(out.error, 'bad request');
  });

  it('falls back to submitted when statuses are missing', () => {
    const out = __parseOrderResponseForTest({}, 'BTC', 'buy', '1', '1');
    assert.equal(out.status, 'submitted');
  });
});

describe('trade wire preflight', () => {
  it('throws when size wire rounds to zero', () => {
    assert.throws(
      () => __validateOrderWireValuesForTest({
        coin: 'BTC',
        sizeInput: '0.0001',
        sizeWire: '0',
        szDecimals: 3,
        priceWire: '90000',
      }),
      /below minimum step/i,
    );
  });

  it('passes for positive wire size and price', () => {
    assert.doesNotThrow(() => __validateOrderWireValuesForTest({
      coin: 'BTC',
      sizeInput: '0.001',
      sizeWire: '0.001',
      szDecimals: 3,
      priceWire: '90000',
    }));
  });
});
