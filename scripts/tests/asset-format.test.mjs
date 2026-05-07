import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatResult } from '../format.mjs';

describe('asset format', () => {
  it('formats asset search rows', () => {
    const output = formatResult({
      ok: true,
      type: 'asset-search',
      data: {
        query: { q: 'BTC' },
        payload: [{ id: 1, symbol: 'BTC', type: 'CRYPTO', rank: 1, price: 100, marketCap: 1000000, name: 'Bitcoin' }],
      },
    });

    assert.ok(output.includes('Asset search'));
    assert.ok(output.includes('BTC'));
    assert.ok(output.includes('Bitcoin'));
  });

  it('formats asset list rows', () => {
    const output = formatResult({
      ok: true,
      type: 'asset-list',
      data: {
        query: { type: 'CRYPTO', page: 1, limit: 1 },
        payload: { items: [{ id: 1, symbol: 'BTC', type: 'CRYPTO', price: 100, change24h: 2.5, marketCap: 1000000, name: 'Bitcoin' }], total: 10, page: 1, limit: 1 },
        meta: { cache: 'HIT' },
      },
    });

    assert.ok(output.includes('Assets CRYPTO (1 of 10)'));
    assert.ok(output.includes('+2.50%'));
    assert.ok(output.includes('Cache: HIT'));
  });

  it('formats asset detail metadata', () => {
    const output = formatResult({
      ok: true,
      type: 'asset-detail',
      data: {
        path: '/api/assets/1',
        payload: {
          id: 1,
          symbol: 'BTC',
          name: 'Bitcoin',
          type: 'CRYPTO',
          rank: 1,
          price: 100,
          change24h: 1.25,
          marketCap: 1000000,
          volume24h: 500000,
          cryptoMeta: { website: 'https://bitcoin.org', categories: ['Layer 1'] },
        },
      },
    });

    assert.ok(output.includes('Asset #1 BTC'));
    assert.ok(output.includes('Crypto metadata'));
    assert.ok(output.includes('https://bitcoin.org'));
  });

  it('formats klines and pairs', () => {
    const klines = formatResult({
      ok: true,
      type: 'asset-klines',
      data: {
        path: '/api/assets/1/klines',
        query: { interval: 'D1' },
        payload: [{ openTime: '2026-01-01T00:00:00.000Z', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 }],
      },
    });
    const pairs = formatResult({
      ok: true,
      type: 'asset-pairs',
      data: {
        query: { page: 1, limit: 1 },
        payload: { items: [{ exchange: 'BINANCE', venue: 'CEX', marketType: 'SPOT', pair: 'BTCUSDT', price: 100 }], page: 1, limit: 1, hasNext: false },
      },
    });

    assert.ok(klines.includes('Asset klines'));
    assert.ok(klines.includes('Rows: 1'));
    assert.ok(pairs.includes('Asset pairs'));
    assert.ok(pairs.includes('BTCUSDT'));
  });

  it('formats sec filings, rwa, and stats', () => {
    const filings = formatResult({
      ok: true,
      type: 'asset-sec-filings',
      data: { payload: { items: [{ formType: '10-K', filingDate: '2026-01-01T00:00:00.000Z', accessionNo: 'abc' }], total: 1, page: 1, limit: 20 } },
    });
    const rwa = formatResult({
      ok: true,
      type: 'asset-rwa',
      data: { payload: { items: [{ rank: 1, symbol: 'XAU', name: 'Gold', rwaPrice: 100, changePct: 1.5 }], total: 1, page: 1, limit: 50 } },
    });
    const stats = formatResult({
      ok: true,
      type: 'asset-stats',
      data: { payload: { totalMarketCap: 1000000, btcDominance: 50, snapshotAt: '2026-01-01T00:00:00.000Z' } },
    });

    assert.ok(filings.includes('SEC filings'));
    assert.ok(filings.includes('10-K'));
    assert.ok(rwa.includes('RWA assets'));
    assert.ok(stats.includes('Asset global stats'));
    assert.ok(stats.includes('BTC dominance: +50.00%'));
  });
});
