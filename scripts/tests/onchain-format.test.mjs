import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatResult } from '../format.mjs';

describe('onchain format', () => {
  it('formats onchain health', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-health',
      data: { path: '/api/v1/health', payload: { status: 'ok' } },
    });
    assert.ok(output.includes('Onchain health OK'));
    assert.ok(output.includes('/api/v1/health'));
  });

  it('formats onchain mids table', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-mids',
      data: {
        path: '/api/v1/hl/prices/mids',
        payload: { BTC: '90000', ETH: '3000' },
      },
    });
    assert.ok(output.includes('Onchain mids'));
    assert.ok(output.includes('BTC'));
    assert.ok(output.includes('ETH'));
  });

  it('unwraps code/data/msg envelope for mids', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-mids',
      data: {
        path: '/api/v1/hl/prices/mids',
        payload: { code: 0, msg: 'ok', data: { BTC: '90000', ETH: '3000' } },
      },
    });
    assert.ok(output.includes('BTC'));
    assert.ok(output.includes('ETH'));
    assert.equal(output.includes('code'), false);
  });

  it('unwraps nested mids object', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-mids',
      data: {
        path: '/api/v1/hl/prices/mids',
        payload: { code: 0, msg: 'ok', data: { mids: { BTC: '90000' } } },
      },
    });
    assert.ok(output.includes('BTC'));
    assert.equal(output.includes('mids  NaN'), false);
  });

  it('does not render NaN rows for non-price objects', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-mids',
      data: {
        path: '/api/v1/hl/prices/mids',
        payload: { code: 200, msg: 'ok', data: { mids: { nested: { a: 1 } } } },
      },
    });
    assert.equal(output.includes('NaN'), false);
  });

  it('formats onchain leaderboard table', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-leaderboard',
      data: {
        path: '/api/v1/leaderboard',
        payload: [{ rank: 1, user: '0xabc', pnl: '100' }],
      },
    });
    assert.ok(output.includes('Onchain leaderboard'));
    assert.ok(output.includes('0xabc'));
  });

  it('formats leaderboard rows with ethAddress and windowPerformances', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-leaderboard',
      data: {
        path: '/api/v1/leaderboard',
        query: { sort: 'pnl_day', page: 1, limit: 10 },
        payload: {
          code: 0,
          msg: 'ok',
          data: {
            data: [
              {
                ethAddress: '0x111',
                accountValue: '12345.67',
                windowPerformances: [{ window: 'day', pnl: '88.9' }],
              },
            ],
          },
        },
      },
    });
    assert.ok(output.includes('0x111'));
    assert.ok(output.includes('88.9'));
    assert.equal(output.includes('—'), false);
  });

  it('fills rank for spot-holders when api rank is missing', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-spot-holders',
      data: {
        path: '/api/v1/hl/spot/holders',
        query: { limit: 5 },
        payload: [
          { address: '0x1', amount: '10' },
          { address: '0x2', amount: '9' },
        ],
      },
    });
    assert.ok(output.includes('0x1'));
    assert.ok(output.includes('1'));
    assert.ok(output.includes('2'));
  });

  it('computes paged rank for spot-holders', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-spot-holders',
      data: {
        path: '/api/v1/hl/spot/holders',
        query: { page: 2, limit: 5 },
        payload: [
          { address: '0x1', amount: '10' },
        ],
      },
    });
    assert.ok(output.includes('6'));
  });

  it('formats liquidation-map as full heatmap table', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-liquidation-map',
      data: {
        path: '/api/v1/hl/perp/liquidation-map',
        query: { coin: 'xyz:TSLA' },
        payload: {
          code: 0,
          msg: 'ok',
          data: {
            coin: 'xyz:TSLA',
            heatmap: [
              {
                coin: 'xyz:TSLA',
                priceBinIndex: 1,
                priceBinStart: 100,
                priceBinEnd: 110,
                liquidationValue: 123456.78,
                positionsCount: 5,
                mostImpactedSegment: 2,
              },
            ],
          },
        },
      },
    });
    assert.ok(output.includes('Coin: xyz:TSLA'));
    assert.ok(output.includes('Liq Value'));
    assert.ok(output.includes('123,456.78'));
    assert.ok(output.includes('Rows: 1'));
  });
});
