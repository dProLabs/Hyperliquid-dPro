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

describe('trade advanced commands', () => {
  afterEach(() => {
    __resetTradeDepsForTest();
  });

  it('modifies an order', async () => {
    let called = null;
    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getAgentPrivateKey: () => 'b'.repeat(64),
      resolveAsset: async () => ({ asset: 1, coin: 'BTC', kind: 'perp', szDecimals: 3 }),
      findRelatedSymbols: async () => [],
      exchangeClient: {
        modifyOrder: async (oid, orderSpec) => {
          called = { oid, orderSpec };
          return { status: 'ok' };
        },
      },
    });

    const out = await trade.modify({
      marketType: 'perp',
      target: '123',
      args: { side: 'buy', size: '0.01', coin: 'BTC', price: '50000' },
      flags: { tif: 'Gtc' },
    }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'modify_result');
    assert.equal(called.oid, 123);
    assert.equal(called.orderSpec.asset, 1);
  });

  it('creates twap order', async () => {
    let called = null;
    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getAgentPrivateKey: () => 'b'.repeat(64),
      resolveAsset: async () => ({ asset: 7, coin: 'xyz:NVDA', kind: 'perp', szDecimals: 2 }),
      findRelatedSymbols: async () => [],
      exchangeClient: {
        twapOrder: async (...args) => {
          called = args;
          return { response: { data: { status: { running: { twapId: 88 } } } } };
        },
      },
    });

    const out = await trade.twapCreate({
      marketType: 'hip3',
      target: 'XYZ:NVDA',
      args: { side: 'buy', size: '1' },
      flags: { minutes: '10', randomize: true },
    }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'twap_result');
    assert.equal(out.data.twapId, 88);
    assert.equal(called[0], 7);
    assert.equal(called[4], 10);
  });

  it('places batch limit orders', async () => {
    let called = null;
    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getAgentPrivateKey: () => 'b'.repeat(64),
      resolveAsset: async () => ({ asset: 1, coin: 'BTC', kind: 'perp', szDecimals: 3 }),
      findRelatedSymbols: async () => [],
      infoClient: { getMaxBuilderFee: async () => 0 },
      exchangeClient: {
        placeOrders: async (orders) => {
          called = orders;
          return {
            response: {
              data: {
                statuses: [
                  { resting: { oid: 1 } },
                  { filled: { oid: 2 } },
                ],
              },
            },
          };
        },
      },
    });

    const out = await trade.batchLimit({
      marketType: 'perp',
      target: 'BTC',
      args: { side: 'buy', entries: '0.01@50000,0.02@49000' },
      flags: {},
    }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'batch_order_result');
    assert.equal(called.length, 2);
    assert.equal(out.data.submitted, 2);
  });

  it('cancels multiple orders and reports skipped ids', async () => {
    let called = null;
    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getAgentPrivateKey: () => 'b'.repeat(64),
      resolveAsset: async () => ({ asset: 1, coin: 'BTC', kind: 'perp', szDecimals: 3 }),
      findRelatedSymbols: async () => [],
      infoClient: {
        getOpenOrders: async () => ([{ oid: 1, coin: 'BTC', asset: 1 }]),
      },
      exchangeClient: {
        cancelOrders: async (cancels) => {
          called = cancels;
          return { status: 'ok' };
        },
      },
    });

    const out = await trade.cancelMultiple({
      marketType: 'perp',
      args: { oids: '1,2' },
      flags: {},
    }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'cancel-multiple_result');
    assert.equal(called.length, 1);
    assert.equal(out.data.skipped.length, 1);
    assert.equal(out.data.skipped[0].oid, '2');
  });

  it('closes position with market-like IOC reduce-only order', async () => {
    let called = null;
    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getAgentPrivateKey: () => 'b'.repeat(64),
      resolveAsset: async () => ({ asset: 1, coin: 'BTC', apiName: 'BTC', kind: 'perp', szDecimals: 3 }),
      findRelatedSymbols: async () => [],
      findMarket: async () => ({ ctx: { midPx: '100' } }),
      infoClient: {
        getAllPerpMetas: async () => ([{ universe: [{ name: 'BTC' }] }]),
        getClearinghouseState: async () => ({ assetPositions: [{ position: { coin: 'BTC', szi: '0.6' } }] }),
        getAllMids: async () => ({ BTC: '100' }),
        getMaxBuilderFee: async () => 0,
      },
      exchangeClient: {
        placeOrder: async (orderSpec) => {
          called = orderSpec;
          return { statuses: ['success'] };
        },
      },
    });

    const out = await trade.closePosition({
      marketType: 'perp',
      target: 'BTC',
      flags: { size: '0.2', slippage: '0.5' },
      args: {},
    }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'close_result');
    assert.equal(called.reduceOnly, true);
    assert.equal(called.isBuy, false);
  });

  it('reverses position by closing and opening opposite side', async () => {
    let called = null;
    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getAgentPrivateKey: () => 'b'.repeat(64),
      resolveAsset: async () => ({ asset: 1, coin: 'BTC', apiName: 'BTC', kind: 'perp', szDecimals: 3 }),
      findRelatedSymbols: async () => [],
      findMarket: async () => ({ ctx: { midPx: '100' } }),
      infoClient: {
        getAllPerpMetas: async () => ([{ universe: [{ name: 'BTC' }] }]),
        getClearinghouseState: async () => ({ assetPositions: [{ position: { coin: 'BTC', szi: '-0.5' } }] }),
        getAllMids: async () => ({ BTC: '100' }),
        getMaxBuilderFee: async () => 0,
      },
      exchangeClient: {
        placeOrder: async (orderSpec) => {
          called = orderSpec;
          return { statuses: ['success'] };
        },
      },
    });

    const out = await trade.reversePosition({
      marketType: 'perp',
      target: 'BTC',
      flags: { size: '0.3', slippage: '0.5' },
      args: {},
    }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'reverse_result');
    assert.equal(called.isBuy, true);
    assert.equal(out.data.targetSide, 'long');
  });

  it('places scale order as generated limit ladder', async () => {
    let called = null;
    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getAgentPrivateKey: () => 'b'.repeat(64),
      resolveAsset: async () => ({ asset: 1, coin: 'BTC', kind: 'perp', szDecimals: 3 }),
      findRelatedSymbols: async () => [],
      infoClient: {
        getMaxBuilderFee: async () => 0,
      },
      exchangeClient: {
        placeOrders: async (orders) => {
          called = orders;
          return { response: { data: { statuses: ['success', 'success', 'success'] } } };
        },
      },
    });

    const out = await trade.scaleOrder({
      marketType: 'perp',
      target: 'BTC',
      args: { side: 'buy' },
      flags: { from: '100', to: '110', count: '3', 'total-size': '0.9' },
    }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'scale_result');
    assert.equal(called.length, 3);
    assert.equal(out.data.count, 3);
  });

  it('places TP/SL grouped orders for existing position', async () => {
    let calledOpts = null;
    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getAgentPrivateKey: () => 'b'.repeat(64),
      resolveAsset: async () => ({ asset: 1, coin: 'BTC', kind: 'perp', szDecimals: 3 }),
      findRelatedSymbols: async () => [],
      infoClient: {
        getAllPerpMetas: async () => ([{ universe: [{ name: 'BTC' }] }]),
        getClearinghouseState: async () => ({ assetPositions: [{ position: { coin: 'BTC', szi: '1.2' } }] }),
        getMaxBuilderFee: async () => 0,
      },
      exchangeClient: {
        placeOrders: async (_orders, _pk, _agent, opts) => {
          calledOpts = opts;
          return { response: { data: { statuses: ['success', 'success'] } } };
        },
      },
    });

    const out = await trade.tpsl({
      marketType: 'perp',
      target: 'BTC',
      flags: { tp: '120', sl: '90' },
      args: {},
    }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'tpsl_result');
    assert.equal(calledOpts.grouping, 'positionTpsl');
  });

  it('creates OTO grouped order set', async () => {
    let calledOpts = null;
    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getAgentPrivateKey: () => 'b'.repeat(64),
      resolveAsset: async () => ({ asset: 1, coin: 'BTC', kind: 'perp', szDecimals: 3 }),
      findRelatedSymbols: async () => [],
      infoClient: {
        getMaxBuilderFee: async () => 0,
      },
      exchangeClient: {
        placeOrders: async (_orders, _pk, _agent, opts) => {
          calledOpts = opts;
          return { response: { data: { statuses: ['success', 'success', 'success'] } } };
        },
      },
    });

    const out = await trade.oto({
      marketType: 'perp',
      target: 'BTC',
      args: { side: 'buy', size: '0.5', entryPrice: '100' },
      flags: { tp: '110', sl: '95' },
    }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'oto_result');
    assert.equal(calledOpts.grouping, 'normalTpsl');
  });
});
