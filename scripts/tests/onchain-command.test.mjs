import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import onchain from '../commands/onchain.mjs';

const originalFetch = globalThis.fetch;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('onchain commands', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('builds spot-holders query correctly', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ rows: [{ address: '0x1', amount: '1' }] });
    };

    const result = await onchain.spotHolders({
      target: 'purr',
      flags: { page: '2', limit: '5' },
    }, {});

    assert.equal(result.ok, true);
    assert.equal(result.type, 'onchain-spot-holders');
    assert.match(capturedUrl, /^https:\/\/api\.d\.pro\/api\/v1\/hl\/spot\/holders\?/);
    assert.ok(capturedUrl.includes('coin=PURR'));
    assert.ok(capturedUrl.includes('page=2'));
    assert.ok(capturedUrl.includes('limit=5'));
  });

  it('passes through spot-holders order and address filters', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ rows: [] });
    };

    await onchain.spotHolders({
      target: 'PURR',
      flags: { order: 'asc', address: '0xabc' },
    }, {});

    assert.ok(capturedUrl.includes('order=asc'));
    assert.ok(capturedUrl.includes('address=0xabc'));
  });

  it('maps api non-2xx to API_REJECTED', async () => {
    globalThis.fetch = async () => jsonResponse({ error: 'bad request' }, 400);

    await assert.rejects(
      () => onchain.health({ flags: {} }, {}),
      (err) => err.code === 'API_REJECTED',
    );
  });

  it('maps network failures to NETWORK_ERROR', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('network down');
    };

    await assert.rejects(
      () => onchain.mids({ flags: {} }, {}),
      (err) => err.code === 'NETWORK_ERROR',
    );
  });

  it('uses fixed onchain base URL', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ ok: true });
    };

    await onchain.ping({ flags: {} }, { onchainApiBaseUrl: 'https://ctx-base.test/' });
    assert.match(capturedUrl, /^https:\/\/api\.d\.pro\/api\/v1$/);
  });

  it('normalizes namespaced coin for perp-holders as dex-lower + symbol-upper', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ data: [] });
    };

    await onchain.perpHolders({
      target: 'XYZ:NVDA',
      flags: { limit: '5', order: 'desc' },
    }, {});

    assert.ok(capturedUrl.includes('coin=xyz%3ANVDA'));
  });

  it('normalizes namespaced coin for liquidation-map', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ data: [] });
    };

    await onchain.liquidationMap({
      target: 'xyz:nvda',
      flags: {},
    }, {});

    assert.ok(capturedUrl.includes('coin=xyz%3ANVDA'));
    assert.match(capturedUrl, /^https:\/\/api\.d\.pro\/api\/v1\/hl\/liqmap\?/);
  });

  it('builds liqmap-timeline query with from and to', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse([]);
    };

    await onchain.liqmapTimeline({
      target: 'BTC',
      flags: { from: '2025-01-01T00:00:00Z', to: '2025-01-07T00:00:00Z' },
    }, {});

    assert.match(capturedUrl, /^https:\/\/api\.d\.pro\/api\/v1\/hl\/liqmap\/timeline\?/);
    assert.ok(capturedUrl.includes('coin=BTC'));
    assert.ok(capturedUrl.includes('from=2025-01-01T00%3A00%3A00Z'));
    assert.ok(capturedUrl.includes('to=2025-01-07T00%3A00%3A00Z'));
  });

  it('builds orders-book query correctly', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ orders: [] });
    };

    await onchain.ordersBook({
      target: 'BTC',
      flags: { page: '1', limit: '20' },
    }, {});

    assert.match(capturedUrl, /^https:\/\/api\.d\.pro\/api\/v1\/hl\/orders\/book\?/);
    assert.ok(capturedUrl.includes('coin=BTC'));
    assert.ok(capturedUrl.includes('page=1'));
    assert.ok(capturedUrl.includes('limit=20'));
  });

  it('builds trending query correctly', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ period: '1h', spot: { items: [] }, perp: { items: [] } });
    };

    await onchain.trending({ flags: { period: '1h', market: 'spot', page: '2', limit: '5' } }, {});

    assert.match(capturedUrl, /^https:\/\/api\.d\.pro\/api\/v1\/hl\/trending\?/);
    assert.ok(capturedUrl.includes('period=1h'));
    assert.ok(capturedUrl.includes('market=spot'));
    assert.ok(capturedUrl.includes('page=2'));
    assert.ok(capturedUrl.includes('limit=5'));
  });

  it('builds hip3-fills query correctly', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ items: [], pagination: { page: 1, limit: 5, total: 0, totalPages: 0 } });
    };

    await onchain.hip3Fills({
      target: 'xyz:tsla',
      flags: { startTime: '1', endTime: '2', page: '1', limit: '5' },
    }, {});

    assert.match(capturedUrl, /^https:\/\/api\.d\.pro\/api\/v1\/hip3\/fills\?/);
    assert.ok(capturedUrl.includes('coin=xyz%3ATSLA'));
    assert.ok(capturedUrl.includes('startTime=1'));
    assert.ok(capturedUrl.includes('endTime=2'));
    assert.ok(capturedUrl.includes('page=1'));
    assert.ok(capturedUrl.includes('limit=5'));
  });

  it('builds prediction positions query correctly', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ market: 'prediction', holders: [] });
    };

    const result = await onchain.predictionPositions({
      target: '9',
      flags: { order: 'asc', address: '0xabc', page: '2', limit: '10' },
    }, {});

    assert.equal(result.type, 'onchain-prediction-positions');
    assert.match(capturedUrl, /^https:\/\/api\.d\.pro\/api\/v1\/hl\/prediction\/positions\?/);
    assert.ok(capturedUrl.includes('outcomeId=9'));
    assert.ok(capturedUrl.includes('order=asc'));
    assert.ok(capturedUrl.includes('address=0xabc'));
  });

  it('builds prediction order book query from outcome and side', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ market: 'prediction', orders: [] });
    };

    await onchain.predictionOrdersBook({
      flags: { 'outcome-id': '9', side: '0', limit: '20' },
    }, {});

    assert.match(capturedUrl, /^https:\/\/api\.d\.pro\/api\/v1\/hl\/prediction\/orders\/book\?/);
    assert.ok(capturedUrl.includes('outcomeId=9'));
    assert.ok(capturedUrl.includes('side=0'));
    assert.ok(capturedUrl.includes('limit=20'));
  });

  it('builds prediction batch query from outcome ids', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ market: 'prediction', items: [] });
    };

    await onchain.predictionOrdersUntriggeredBatch({
      flags: { 'outcome-ids': '9,10', sides: '0,1', page: '1' },
    }, {});

    assert.match(capturedUrl, /^https:\/\/api\.d\.pro\/api\/v1\/hl\/prediction\/orders\/untriggered\/batch\?/);
    assert.ok(capturedUrl.includes('outcomeIds=9%2C10'));
    assert.ok(capturedUrl.includes('sides=0%2C1'));
  });

  it('builds tradfi ranking queries correctly', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ period: '24h', items: [] });
    };

    await onchain.tradfiGainersHolderPnlTop({
      flags: { 'asset-limit': '5', 'holder-limit': '3', period: '24h' },
    }, {});

    assert.match(capturedUrl, /^https:\/\/api\.d\.pro\/api\/v1\/hl\/tradfi\/gainers-holder-pnl-top\?/);
    assert.ok(capturedUrl.includes('period=24h'));
    assert.ok(capturedUrl.includes('assetLimit=5'));
    assert.ok(capturedUrl.includes('holderLimit=3'));
  });

  it('builds smart trader queries correctly', async () => {
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(String(url));
      return jsonResponse({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    };

    await onchain.hip3SmartTrader({
      target: 'xyz:tsla',
      flags: { sort: 'pnlPct', order: 'desc', limit: '10' },
    }, {});
    await onchain.hip4SmartTrader({
      target: '123',
      flags: { sort: 'pnl', order: 'asc', limit: '5' },
    }, {});

    assert.match(urls[0], /^https:\/\/api\.d\.pro\/api\/v1\/hip3\/smart-trader\?/);
    assert.ok(urls[0].includes('coin=xyz%3ATSLA'));
    assert.ok(urls[0].includes('sort=pnlPct'));
    assert.match(urls[1], /^https:\/\/api\.d\.pro\/api\/v1\/hip4\/smart-trader\?/);
    assert.ok(urls[1].includes('tokenId=123'));
  });

  it('returns local deprecation notice for spot-meta', async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return jsonResponse({});
    };

    const result = await onchain.spotMeta({ flags: {} }, {});

    assert.equal(result.ok, true);
    assert.equal(result.type, 'onchain-spot-meta-deprecated');
    assert.equal(called, false);
  });
});
