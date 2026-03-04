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
  });
});
