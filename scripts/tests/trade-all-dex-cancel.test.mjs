import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import trade, { __setTradeDepsForTest, __resetTradeDepsForTest } from '../commands/trade.mjs';

describe('trade cancel all-dex behavior', () => {
  afterEach(() => {
    __resetTradeDepsForTest();
  });

  it('cancel uses ALL_DEXS openOrders and resolves hip-3 asset', async () => {
    const calls = [];
    __setTradeDepsForTest({
      resolveAccount: () => ({
        alias: 'main',
        mode: 'api',
        masterAddress: '0x1234567890abcdef1234567890abcdef12345678',
        agentAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
      getAgentPrivateKey: () => 'b'.repeat(64),
      infoClient: {
        getOpenOrders: async (user, opts) => {
          calls.push({ fn: 'getOpenOrders', user, opts });
          return [{ oid: 77, coin: 'XYZ:AAPL' }];
        },
      },
      resolveAsset: async () => ({ asset: 110000, coin: 'XYZ:AAPL', kind: 'perp', szDecimals: 2 }),
      findRelatedSymbols: async () => [],
      exchangeClient: {
        cancelOrders: async (cancels) => {
          calls.push({ fn: 'cancelOrders', cancels });
          return { status: 'ok', response: { type: 'cancel', data: { statuses: ['success'] } } };
        },
      },
    });

    const out = await trade.cancel(
      { target: '77', flags: {} },
      { network: 'mainnet' },
    );

    assert.equal(out.ok, true);
    assert.equal(calls[0].fn, 'getOpenOrders');
    assert.equal(calls[0].opts.dex, 'ALL_DEXS');
    assert.deepEqual(calls[1].cancels, [{ asset: 110000, oid: 77 }]);
  });

  it('cancel-all handles multiple hip-3 orders', async () => {
    let sentCancels = null;
    __setTradeDepsForTest({
      resolveAccount: () => ({
        alias: 'main',
        mode: 'api',
        masterAddress: '0x1234567890abcdef1234567890abcdef12345678',
        agentAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
      getAgentPrivateKey: () => 'b'.repeat(64),
      infoClient: {
        getOpenOrders: async (_user, opts) => {
          assert.equal(opts.dex, 'ALL_DEXS');
          return [{ oid: 1, coin: 'FLX:TSLA' }, { oid: 2, coin: 'VNTL:GOLD' }];
        },
      },
      resolveAsset: async (coin) => ({
        asset: coin.startsWith('FLX:') ? 120001 : 130005,
        coin,
        kind: 'perp',
        szDecimals: 2,
      }),
      findRelatedSymbols: async () => [],
      exchangeClient: {
        cancelOrders: async (cancels) => {
          sentCancels = cancels;
          return { status: 'ok' };
        },
      },
    });

    const out = await trade.cancelAll({ flags: {} }, { network: 'mainnet' });
    assert.equal(out.data.count, 2);
    assert.deepEqual(sentCancels, [
      { asset: 120001, oid: 1 },
      { asset: 130005, oid: 2 },
    ]);
  });

  it('market order falls back to market ctx mid when mids key is missing', async () => {
    __setTradeDepsForTest({
      resolveAccount: () => ({
        alias: 'main',
        mode: 'api',
        masterAddress: '0x1234567890abcdef1234567890abcdef12345678',
        agentAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
      getAgentPrivateKey: () => 'b'.repeat(64),
      infoClient: {
        getAllMids: async () => ({ OTHER: '1' }),
      },
      resolveAsset: async () => ({ asset: 110000, coin: 'XYZ:NVDA', kind: 'perp', szDecimals: 2 }),
      findRelatedSymbols: async () => [],
      findMarket: async () => ({ coin: 'XYZ:NVDA', ctx: { midPx: '73029.433', markPx: '73020' } }),
      exchangeClient: {
        placeOrder: async () => ({
          response: { data: { statuses: [{ resting: { oid: 1 } }] } },
        }),
      },
    });

    const out = await trade.market(
      { target: 'XYZ:NVDA', args: { side: 'sell', size: '0.1' }, flags: {} },
      { network: 'mainnet' },
    );

    assert.equal(out.ok, true);
    assert.equal(out.type, 'order_result');
    assert.equal(out.data.status, 'resting');
  });
});
