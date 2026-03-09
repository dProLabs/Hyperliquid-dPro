import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import trade, { __setTradeDepsForTest, __resetTradeDepsForTest } from '../commands/trade.mjs';

function makeApiAccount() {
  return {
    alias: 'main',
    mode: 'api',
    masterAddress: '0x1234567890abcdef1234567890abcdef12345678',
    agentAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };
}

describe('trade namespace rules', () => {
  afterEach(() => {
    __resetTradeDepsForTest();
  });

  it('rejects reduce-only for spot limit orders', async () => {
    await assert.rejects(
      () => trade.limit({ marketType: 'spot', target: 'PURR', args: { side: 'buy', size: '1', price: '0.1' }, flags: { 'reduce-only': true } }, {}),
      /reduce-only/i,
    );
  });

  it('rejects set-leverage on spot namespace', async () => {
    await assert.rejects(
      () => trade.setLeverage({ marketType: 'spot', target: 'PURR', args: { leverage: '5' }, flags: {} }, {}),
      /spot markets/i,
    );
  });

  it('rejects namespaced coin in perp namespace', async () => {
    await assert.rejects(
      () => trade.market({ marketType: 'perp', target: 'XYZ:NVDA', args: { side: 'buy', size: '1' }, flags: {} }, {}),
      /do not accept namespaced/i,
    );
  });

  it('requires namespaced coin in hip3 namespace', async () => {
    await assert.rejects(
      () => trade.market({ marketType: 'hip3', target: 'NVDA', args: { side: 'buy', size: '1' }, flags: {} }, {}),
      /require namespaced/i,
    );
  });

  it('cancel-all only cancels orders in selected namespace', async () => {
    let sentCancels = null;
    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getAgentPrivateKey: () => 'b'.repeat(64),
      infoClient: {
        getOpenOrders: async () => ([
          { oid: 1, coin: 'BTC' },
          { oid: 2, coin: 'PURR' },
          { oid: 3, coin: 'XYZ:NVDA' },
        ]),
      },
      resolveAsset: async (coin, hint) => {
        if (coin === 'BTC' && hint === 'perp') return { asset: 1, coin: 'BTC', kind: 'perp', szDecimals: 3 };
        if (coin === 'PURR' && hint === 'spot') return { asset: 10001, coin: 'PURR', kind: 'spot', szDecimals: 2 };
        if (coin === 'XYZ:NVDA' && hint === 'perp') return { asset: 110000, coin: 'XYZ:NVDA', kind: 'perp', szDecimals: 2 };
        const err = new Error('not found');
        err.code = 'ASSET_NOT_FOUND';
        throw err;
      },
      findRelatedSymbols: async () => [],
      exchangeClient: {
        cancelOrders: async (cancels) => {
          sentCancels = cancels;
          return { status: 'ok' };
        },
      },
    });

    const out = await trade.cancelAll({ marketType: 'perp', flags: {} }, { network: 'mainnet' });
    assert.equal(out.data.count, 1);
    assert.deepEqual(sentCancels, [{ asset: 1, oid: 1 }]);
  });

  it('rejects cancel when namespace does not match order namespace', async () => {
    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getAgentPrivateKey: () => 'b'.repeat(64),
      infoClient: {
        getOpenOrders: async () => ([{ oid: 77, coin: 'XYZ:AAPL' }]),
      },
      resolveAsset: async () => ({ asset: 110000, coin: 'XYZ:AAPL', kind: 'perp', szDecimals: 2 }),
      findRelatedSymbols: async () => [],
      exchangeClient: {
        cancelOrders: async () => ({ status: 'ok' }),
      },
    });

    await assert.rejects(
      () => trade.cancel({ marketType: 'perp', target: '77', flags: {} }, { network: 'mainnet' }),
      /belongs to hip3/i,
    );
  });
});
