import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import trade, { __setTradeDepsForTest, __resetTradeDepsForTest } from '../commands/trade.mjs';
import { BUILDER_ADDRESS, BUILDER_FEE } from '../constants.mjs';

function makeApiAccount() {
  return {
    alias: 'main',
    mode: 'api',
    masterAddress: '0x1234567890abcdef1234567890abcdef12345678',
    agentAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };
}

describe('trade builder-fee behavior', () => {
  afterEach(() => {
    __resetTradeDepsForTest();
  });

  it('adds builder payload when maxBuilderFee is approved', async () => {
    let placeOrderOpts = null;

    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getAgentPrivateKey: () => 'b'.repeat(64),
      resolveAsset: async () => ({ asset: 1, coin: 'BTC', kind: 'perp', szDecimals: 3 }),
      findRelatedSymbols: async () => [],
      findMarket: async () => null,
      infoClient: {
        getAllMids: async () => ({ BTC: '70000' }),
        getMaxBuilderFee: async () => 100,
      },
      exchangeClient: {
        placeOrder: async (_spec, _key, _agent, opts) => {
          placeOrderOpts = opts;
          return { statuses: ['success'] };
        },
      },
    });

    const out = await trade.market({
      marketType: 'perp',
      target: 'BTC',
      args: { side: 'buy', size: '0.01' },
      flags: { slippage: '0.5' },
    }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.deepEqual(placeOrderOpts.builder, { b: BUILDER_ADDRESS, f: BUILDER_FEE });
  });

  it('does not add builder payload when maxBuilderFee is zero', async () => {
    let placeOrderOpts = null;

    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getAgentPrivateKey: () => 'b'.repeat(64),
      resolveAsset: async () => ({ asset: 1, coin: 'BTC', kind: 'perp', szDecimals: 3 }),
      findRelatedSymbols: async () => [],
      infoClient: {
        getMaxBuilderFee: async () => 0,
      },
      exchangeClient: {
        placeOrder: async (_spec, _key, _agent, opts) => {
          placeOrderOpts = opts;
          return { statuses: ['success'] };
        },
      },
    });

    const out = await trade.limit({
      marketType: 'perp',
      target: 'BTC',
      args: { side: 'buy', size: '0.01', price: '50000' },
      flags: {},
    }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(Object.prototype.hasOwnProperty.call(placeOrderOpts, 'builder'), false);
    assert.ok((out.notices || []).some((w) => w.includes('log in to https://www.d.pro/')));
    assert.equal(Array.isArray(out.warnings), false);
  });

  it('reports builder approval using account alias', async () => {
    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      infoClient: {
        getMaxBuilderFee: async () => 100,
      },
    });

    const out = await trade.builderApproval({
      target: 'main',
      flags: {},
    }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'builder-approval');
    assert.equal(out.data.approved, true);
    assert.equal(out.data.maxBuilderFee, 100);
    assert.deepEqual(out.data.orderBuilder, { b: BUILDER_ADDRESS, f: BUILDER_FEE });
    assert.equal(Array.isArray(out.warnings), false);
  });

  it('reports builder approval notice when account is not approved', async () => {
    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      infoClient: {
        getMaxBuilderFee: async () => 0,
      },
    });

    const out = await trade.builderApproval({
      target: 'main',
      flags: {},
    }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'builder-approval');
    assert.equal(out.data.approved, false);
    assert.equal(out.data.maxBuilderFee, 0);
    assert.equal(out.data.orderBuilder, null);
    assert.ok((out.notices || []).some((w) => w.includes('log in to https://www.d.pro/')));
    assert.equal(Array.isArray(out.warnings), false);
  });
});
