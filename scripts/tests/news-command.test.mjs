import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import news from '../commands/news.mjs';

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

describe('news commands', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('builds news list query correctly', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({
        code: 0,
        message: 'ok',
        data: { items: [], total: 0, page: 2, limit: 5 },
        timestamp: '2026-01-01T00:00:00.000Z',
      }, 200, { 'x-cache': 'HIT' });
    };

    const result = await news.list({
      target: 'BTC',
      flags: { category: 'hot-24h', limit: '5', page: '2', locale: 'en' },
    }, { newsApiBaseUrl: 'https://assets.test/' });

    assert.equal(result.ok, true);
    assert.equal(result.type, 'news-list');
    assert.match(capturedUrl, /^https:\/\/assets\.test\/api\/news\?/);
    assert.ok(capturedUrl.includes('assetSymbol=BTC'));
    assert.ok(capturedUrl.includes('category=hot-24h'));
    assert.ok(capturedUrl.includes('locale=en'));
    assert.ok(capturedUrl.includes('page=2'));
    assert.ok(capturedUrl.includes('limit=5'));
    assert.equal(result.data.payload.total, 0);
    assert.equal(result.data.meta.cache, 'HIT');
  });

  it('lets --asset override positional asset', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ code: 0, message: 'ok', data: { items: [], total: 0, page: 1, limit: 10 } });
    };

    await news.list({
      target: 'BTC',
      flags: { asset: 'xyz:AAPL' },
    }, { newsApiBaseUrl: 'https://assets.test' });

    assert.ok(capturedUrl.includes('assetSymbol=xyz%3AAAPL'));
    assert.equal(capturedUrl.includes('assetSymbol=BTC'), false);
  });

  it('builds news detail query correctly', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (url) => {
      capturedUrl = String(url);
      return jsonResponse({ code: 0, message: 'ok', data: { id: 123, title: 'test' } });
    };

    const result = await news.detail({
      target: '123',
      flags: { asset: 'xyz:AAPL', locale: 'zh-CN' },
    }, { newsApiBaseUrl: 'https://assets.test' });

    assert.equal(result.type, 'news-detail');
    assert.match(capturedUrl, /^https:\/\/assets\.test\/api\/news\/123\?/);
    assert.ok(capturedUrl.includes('assetSymbol=xyz%3AAAPL'));
    assert.ok(capturedUrl.includes('locale=zh-CN'));
  });

  it('rejects limit above upstream max', async () => {
    await assert.rejects(
      () => news.list({ target: null, flags: { limit: '101' } }, {}),
      (err) => err.code === 'INPUT_ERROR',
    );
  });

  it('maps wrapped api errors to API_REJECTED', async () => {
    globalThis.fetch = async () => jsonResponse({ code: 400, message: 'bad query', data: null });

    await assert.rejects(
      () => news.list({ target: null, flags: {} }, { newsApiBaseUrl: 'https://assets.test' }),
      (err) => err.code === 'API_REJECTED',
    );
  });
});
