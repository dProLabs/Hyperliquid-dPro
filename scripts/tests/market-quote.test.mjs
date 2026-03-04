import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __pickQuoteMidForTest } from '../commands/market.mjs';

describe('market quote mid selection', () => {
  it('does not throw when mids is null', () => {
    const mid = __pickQuoteMidForTest(null, null, 'BTC');
    assert.equal(mid, null);
  });

  it('prefers market apiName key for spot', () => {
    const mid = __pickQuoteMidForTest(
      { '@10268': '263.15', AAPL: '999.99' },
      { apiName: '@10268' },
      'AAPL',
    );
    assert.equal(mid, '263.15');
  });

  it('falls back to coin key', () => {
    const mid = __pickQuoteMidForTest(
      { BTC: '90000' },
      null,
      'BTC',
    );
    assert.equal(mid, '90000');
  });

  it('uses canonical market coin key when parser-normalized coin casing differs', () => {
    const mid = __pickQuoteMidForTest(
      { 'xyz:XYZ100': '123.45' },
      { coin: 'xyz:XYZ100' },
      'XYZ:XYZ100',
    );
    assert.equal(mid, '123.45');
  });
});
