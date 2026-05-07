import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatResult } from '../format.mjs';

describe('news format', () => {
  it('formats news list table', () => {
    const output = formatResult({
      ok: true,
      type: 'news-list',
      data: {
        path: '/api/news',
        query: { assetSymbol: 'BTC', category: 'hot-24h', page: 1, limit: 5 },
        meta: { cache: 'HIT' },
        payload: {
          items: [
            {
              id: 42,
              title: 'Bitcoin ETF flows accelerate',
              publishedAt: '2026-01-01T12:34:00.000Z',
              assets: [{ symbol: 'BTC' }],
              directionDisplay: { direction: 'bullish', affectedAssets: 'BTC', locale: 'en' },
            },
          ],
          total: 3,
          page: 1,
          limit: 5,
        },
      },
    });

    assert.ok(output.includes('News (1 of 3)'));
    assert.ok(output.includes('asset=BTC'));
    assert.ok(output.includes('bullish'));
    assert.ok(output.includes('Bitcoin ETF flows accelerate'));
    assert.ok(output.includes('Cache: HIT'));
  });

  it('formats empty news list', () => {
    const output = formatResult({
      ok: true,
      type: 'news-list',
      data: {
        path: '/api/news',
        query: { page: 1, limit: 10 },
        payload: { items: [], total: 0, page: 1, limit: 10 },
      },
    });

    assert.ok(output.includes('No news found.'));
  });

  it('formats news detail with analysis', () => {
    const output = formatResult({
      ok: true,
      type: 'news-detail',
      data: {
        path: '/api/news/42',
        query: {},
        payload: {
          id: 42,
          title: 'Bitcoin ETF flows accelerate',
          summary: 'Funds saw another large inflow day.',
          url: 'https://example.test/news/42',
          source: 'NEWSAPI',
          publisher: 'Example',
          publishedAt: '2026-01-01T12:34:00.000Z',
          assets: [{ symbol: 'BTC' }],
          analysis: {
            locale: 'en',
            coreSummary: 'ETF demand improved near-term sentiment.',
            direction: 'Bullish',
            impactLogic: 'Spot demand can support price.',
            timeHorizon: 'short term',
            risksAndWatchlist: 'Watch flows and macro data.',
          },
        },
      },
    });

    assert.ok(output.includes('News #42'));
    assert.ok(output.includes('Core summary'));
    assert.ok(output.includes('ETF demand improved'));
    assert.ok(output.includes('https://example.test/news/42'));
  });
});
