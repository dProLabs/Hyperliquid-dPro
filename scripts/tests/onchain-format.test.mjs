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

  it('formats onchain spot-meta deprecation notice', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-spot-meta-deprecated',
      data: { message: 'deprecated endpoint' },
    });
    assert.ok(output.includes('deprecated endpoint'));
  });

  it('formats onchain address tags', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-address-tags',
      data: {
        path: '/api/v1/hl/meta/address-tags',
        payload: {
          '0x1': ['Smart'],
          '0x2': ['Whale'],
        },
      },
    });
    assert.ok(output.includes('Onchain address tags'));
    assert.ok(output.includes('0x1'));
    assert.ok(output.includes('Smart'));
  });

  it('formats onchain orders chart table', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-orders-chart',
      data: {
        path: '/api/v1/hl/orders/chart',
        query: { coin: 'BTC', type: 'book' },
        payload: {
          coin: 'BTC',
          type: 'book',
          heatmap: [
            {
              priceBinIndex: 1,
              priceBinStart: 100,
              priceBinEnd: 110,
              orderValue: 1234,
              ordersCount: 3,
            },
          ],
        },
      },
    });
    assert.ok(output.includes('Onchain orders chart'));
    assert.ok(output.includes('BTC'));
    assert.ok(output.includes('Rows: 1'));
  });

  it('formats onchain liqmap timeline table', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-liqmap-timeline',
      data: {
        path: '/api/v1/hl/liqmap/timeline',
        payload: [
          {
            coin: 'BTC',
            snapshotHeight: 123,
            recordedAt: '2025-01-02T00:00:00.000Z',
            bins: [{}, {}],
          },
        ],
      },
    });
    assert.ok(output.includes('Onchain liqmap timeline'));
    assert.ok(output.includes('BTC'));
    assert.ok(output.includes('Rows: 1'));
  });

  it('formats onchain hip3-fills table', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-hip3-fills',
      data: {
        path: '/api/v1/hip3/fills',
        query: { coin: 'xyz:TSLA' },
        payload: {
          items: [
            {
              blockTime: '2026-03-14T00:00:00.000Z',
              coin: 'xyz:TSLA',
              side: 'B',
              sz: '1.5',
              px: '100',
              notionalUsd: '150',
            },
          ],
          pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        },
      },
    });
    assert.ok(output.includes('Onchain HIP-3 fills'));
    assert.ok(output.includes('xyz:TSLA'));
    assert.ok(output.includes('Pagination'));
  });

  it('formats onchain trending all-market summary', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-trending',
      data: {
        path: '/api/v1/hl/trending',
        payload: {
          period: '1h',
          spot: { items: [{ coin: 'PURR' }], pagination: { page: 1, limit: 50, total: 1 } },
          perp: { items: [{ coin: 'BTC' }, { coin: 'ETH' }], pagination: { page: 1, limit: 50, total: 2 } },
        },
      },
    });
    assert.ok(output.includes('Onchain trending (all)'));
    assert.ok(output.includes('spot'));
    assert.ok(output.includes('perp'));
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

  it('formats prediction positions table', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-prediction-positions',
      data: {
        path: '/api/v1/hl/prediction/positions',
        query: { outcomeId: 9, page: 1, limit: 10 },
        payload: {
          market: 'prediction',
          outcomeId: 9,
          outcomeName: 'Will HYPE go up?',
          holders: [
            { address: '0xabc', sideName: 'Yes', balance: '10', value: '7.5', uPnl: '1.2', roe: '12.3' },
          ],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        },
      },
    });
    assert.ok(output.includes('Onchain prediction positions'));
    assert.ok(output.includes('0xabc'));
    assert.ok(output.includes('Yes'));
  });

  it('formats prediction order book and batch summaries', () => {
    const single = formatResult({
      ok: true,
      type: 'onchain-prediction-orders-book',
      data: {
        path: '/api/v1/hl/prediction/orders/book',
        payload: {
          market: 'prediction',
          coin: '#90',
          outcomeId: 9,
          side: 0,
          orders: [{ oid: 1, side: 'B', size: '2', price: '0.5' }],
          pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        },
      },
    });
    assert.ok(single.includes('Onchain prediction orders (book)'));
    assert.ok(single.includes('#90'));

    const batch = formatResult({
      ok: true,
      type: 'onchain-prediction-orders-untriggered-batch',
      data: {
        path: '/api/v1/hl/prediction/orders/untriggered/batch',
        payload: {
          market: 'prediction',
          items: [{ coin: '#90', outcomeId: 9, side: 0, orders: [] }],
          summary: { requested: 1, returned: 1, snapshotHeight: 123 },
        },
      },
    });
    assert.ok(batch.includes('untriggered batch'));
    assert.ok(batch.includes('#90'));
  });

  it('formats tradfi ranking tables', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-tradfi-volume-top',
      data: {
        path: '/api/v1/hl/tradfi/volume-top',
        payload: {
          period: '24h',
          items: [
            { coin: 'xyz:AMD', displayName: 'AMD', price: '100', changePercent24h: '5.5', volume24hUsd: '1000000', openInterestUsd: '250000', maxLeverage: 10 },
          ],
        },
      },
    });
    assert.ok(output.includes('Onchain TradFi volume top'));
    assert.ok(output.includes('xyz:AMD'));
    assert.ok(output.includes('5.50%'));
  });

  it('formats smart trader tables', () => {
    const output = formatResult({
      ok: true,
      type: 'onchain-hip3-smart-trader',
      data: {
        path: '/api/v1/hip3/smart-trader',
        query: { coin: 'xyz:TSLA' },
        payload: {
          coin: 'xyz:TSLA',
          markPx: '250',
          items: [
            { userAddress: '0xabc', pnl: '1200', pnlPct: '12.5', totalBuyUsd: '10000', totalSellUsd: '11200', currentPortfolioValue: '500', tradeCount: 4, lastTradeAt: 1710000000000 },
          ],
          pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        },
      },
    });
    assert.ok(output.includes('Onchain HIP-3 smart traders'));
    assert.ok(output.includes('0xabc'));
    assert.ok(output.includes('12.50%'));
  });
});
