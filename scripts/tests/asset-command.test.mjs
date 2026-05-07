import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import asset from '../commands/asset.mjs';

const originalFetch = globalThis.fetch;

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

describe('asset commands', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('builds search query correctly', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ code: 0, message: 'ok', data: [{ id: 1, symbol: 'BTC' }] }, 200, { 'x-cache': 'HIT' });
    };

    const result = await asset.search({ args: { query: 'BTC' }, flags: {} }, { assetApiBaseUrl: 'https://assets.test/' });

    assert.equal(result.type, 'asset-search');
    assert.match(capturedUrl, /^https:\/\/assets\.test\/api\/search\?/);
    assert.ok(capturedUrl.includes('q=BTC'));
    assert.equal(result.data.meta.cache, 'HIT');
  });

  it('builds asset list query correctly', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ code: 0, message: 'ok', data: { items: [], total: 0, page: 1, limit: 5 } });
    };

    await asset.ls({ flags: { type: 'crypto', sort: 'rank', order: 'asc', limit: '5' } }, { assetApiBaseUrl: 'https://assets.test' });

    assert.match(capturedUrl, /^https:\/\/assets\.test\/api\/assets\?/);
    assert.ok(capturedUrl.includes('type=CRYPTO'));
    assert.ok(capturedUrl.includes('sort=rank'));
    assert.ok(capturedUrl.includes('order=asc'));
    assert.ok(capturedUrl.includes('page=1'));
    assert.ok(capturedUrl.includes('limit=5'));
  });

  it('builds detail and kline paths correctly', async () => {
    const captured = [];
    globalThis.fetch = async (url) => {
      captured.push(String(url));
      return jsonResponse({ code: 0, message: 'ok', data: {} });
    };

    await asset.detail({ target: '3202730', flags: {} }, { assetApiBaseUrl: 'https://assets.test' });
    await asset.klines({ target: '3202730', flags: { interval: 'D1', limit: '30' } }, { assetApiBaseUrl: 'https://assets.test' });

    assert.equal(captured[0], 'https://assets.test/api/assets/3202730');
    assert.match(captured[1], /^https:\/\/assets\.test\/api\/assets\/3202730\/klines\?/);
    assert.ok(captured[1].includes('interval=D1'));
    assert.ok(captured[1].includes('limit=30'));
  });

  it('builds pairs and sec filings queries correctly', async () => {
    const captured = [];
    globalThis.fetch = async (url) => {
      captured.push(String(url));
      return jsonResponse({ code: 0, message: 'ok', data: { items: [], page: 1, limit: 10, hasNext: false } });
    };

    await asset.pairs({ target: '1', flags: { venue: 'cex', 'market-type': 'spot', limit: '10' } }, { assetApiBaseUrl: 'https://assets.test' });
    await asset.secFilings({ target: '1', flags: { page: '2', limit: '5' } }, { assetApiBaseUrl: 'https://assets.test' });

    assert.match(captured[0], /\/api\/assets\/1\/tickers\?/);
    assert.ok(captured[0].includes('venue=cex'));
    assert.ok(captured[0].includes('marketType=spot'));
    assert.match(captured[1], /\/api\/assets\/1\/sec-filings\?/);
    assert.ok(captured[1].includes('page=2'));
    assert.ok(captured[1].includes('limit=5'));
  });

  it('builds rwa and stats queries correctly', async () => {
    const captured = [];
    globalThis.fetch = async (url) => {
      captured.push(String(url));
      return jsonResponse({ code: 0, message: 'ok', data: { items: [], total: 0, page: 1, limit: 5 } });
    };

    await asset.rwa({ flags: { sort: 'rank', limit: '5' } }, { assetApiBaseUrl: 'https://assets.test' });
    await asset.stats({ flags: {} }, { assetApiBaseUrl: 'https://assets.test' });

    assert.match(captured[0], /^https:\/\/assets\.test\/api\/assets\/rwa\?/);
    assert.ok(captured[0].includes('sort=rank'));
    assert.equal(captured[1], 'https://assets.test/api/global-stats');
  });

  it('rejects invalid list type and over-limit klines', async () => {
    await assert.rejects(
      () => asset.ls({ flags: { type: 'ALL' } }, {}),
      (err) => err.code === 'INPUT_ERROR',
    );
    await assert.rejects(
      () => asset.klines({ target: '1', flags: { limit: '501' } }, {}),
      (err) => err.code === 'INPUT_ERROR',
    );
  });

  it('maps wrapped api errors to API_REJECTED', async () => {
    globalThis.fetch = async () => jsonResponse({ code: 400, message: 'bad asset query', data: null });

    await assert.rejects(
      () => asset.search({ args: { query: 'BTC' }, flags: {} }, { assetApiBaseUrl: 'https://assets.test' }),
      (err) => err.code === 'API_REJECTED',
    );
  });
});
