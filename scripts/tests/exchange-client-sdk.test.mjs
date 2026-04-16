import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  placeOrder,
  placeOrders,
  cancelOrders,
  cancelByCloid,
  modifyOrder,
  twapOrder,
  twapCancel,
  updateLeverage,
  updateIsolatedMargin,
  approveBuilderFee,
  usdClassTransfer,
  __setExchangeClientFactoryForTest,
  __resetExchangeClientFactoryForTest,
} from '../clients/exchange-client.mjs';

function createFactoryProbe(methodImpls = {}) {
  const calls = [];
  const fakeClient = {
    order: async (params) => {
      calls.push({ method: 'order', params });
      return methodImpls.order ? methodImpls.order(params) : { statuses: [] };
    },
    cancel: async (params) => {
      calls.push({ method: 'cancel', params });
      return methodImpls.cancel ? methodImpls.cancel(params) : { statuses: [] };
    },
    cancelByCloid: async (params) => {
      calls.push({ method: 'cancelByCloid', params });
      return methodImpls.cancelByCloid ? methodImpls.cancelByCloid(params) : { statuses: [] };
    },
    modify: async (params) => {
      calls.push({ method: 'modify', params });
      return methodImpls.modify ? methodImpls.modify(params) : { status: 'ok' };
    },
    twapOrder: async (params) => {
      calls.push({ method: 'twapOrder', params });
      return methodImpls.twapOrder ? methodImpls.twapOrder(params) : { status: 'ok' };
    },
    twapCancel: async (params) => {
      calls.push({ method: 'twapCancel', params });
      return methodImpls.twapCancel ? methodImpls.twapCancel(params) : { status: 'ok' };
    },
    updateLeverage: async (params) => {
      calls.push({ method: 'updateLeverage', params });
      return methodImpls.updateLeverage ? methodImpls.updateLeverage(params) : { ok: true };
    },
    updateIsolatedMargin: async (params) => {
      calls.push({ method: 'updateIsolatedMargin', params });
      return methodImpls.updateIsolatedMargin ? methodImpls.updateIsolatedMargin(params) : { ok: true };
    },
    approveBuilderFee: async (params) => {
      calls.push({ method: 'approveBuilderFee', params });
      return methodImpls.approveBuilderFee ? methodImpls.approveBuilderFee(params) : { ok: true };
    },
    usdClassTransfer: async (params) => {
      calls.push({ method: 'usdClassTransfer', params });
      return methodImpls.usdClassTransfer ? methodImpls.usdClassTransfer(params) : { status: 'ok' };
    },
  };

  const factoryCalls = [];
  const factory = (privateKeyHex, opts) => {
    factoryCalls.push({ privateKeyHex, opts });
    return fakeClient;
  };
  return { calls, factoryCalls, factory };
}

afterEach(() => {
  __resetExchangeClientFactoryForTest();
});

describe('exchange-client SDK wrapper', () => {
  it('maps placeOrder to exchange.order with grouping=na and cloid', async () => {
    const probe = createFactoryProbe();
    __setExchangeClientFactoryForTest(probe.factory);

    await placeOrder(
      {
        asset: 0,
        isBuy: true,
        price: '95000',
        size: '0.01',
        reduceOnly: false,
        orderType: { limit: { tif: 'Gtc' } },
      },
      '0xabc',
      '0xagent',
      { isTestnet: true, cloid: 'deadbeef' },
    );

    assert.equal(probe.factoryCalls.length, 1);
    assert.equal(probe.factoryCalls[0].opts.isTestnet, true);
    assert.equal(probe.calls[0].method, 'order');
    assert.deepEqual(probe.calls[0].params, {
      orders: [{
        a: 0,
        b: true,
        p: '95000',
        s: '0.01',
        r: false,
        t: { limit: { tif: 'Gtc' } },
        c: 'deadbeef',
      }],
      grouping: 'na',
    });
  });

  it('passes optional builder payload to exchange.order', async () => {
    const probe = createFactoryProbe();
    __setExchangeClientFactoryForTest(probe.factory);

    await placeOrder(
      {
        asset: 0,
        isBuy: true,
        price: '95000',
        size: '0.01',
        reduceOnly: false,
        orderType: { limit: { tif: 'Gtc' } },
      },
      '0xabc',
      '0xagent',
      {
        builder: { b: '0xf36534b07ea0cbbe52194374e7387956fb97ad53', f: 1 },
      },
    );

    assert.equal(probe.calls[0].method, 'order');
    assert.deepEqual(probe.calls[0].params, {
      orders: [{
        a: 0,
        b: true,
        p: '95000',
        s: '0.01',
        r: false,
        t: { limit: { tif: 'Gtc' } },
      }],
      grouping: 'na',
      builder: { b: '0xf36534b07ea0cbbe52194374e7387956fb97ad53', f: 1 },
    });
  });

  it('maps cancelOrders to exchange.cancel', async () => {
    const probe = createFactoryProbe();
    __setExchangeClientFactoryForTest(probe.factory);
    const cancels = [{ asset: 0, oid: 123 }];

    await cancelOrders(cancels, '0xabc', '0xagent', { isTestnet: false });

    assert.equal(probe.calls[0].method, 'cancel');
    assert.deepEqual(probe.calls[0].params, { cancels: [{ a: 0, o: 123 }] });
  });

  it('maps placeOrders to exchange.order with multiple orders', async () => {
    const probe = createFactoryProbe();
    __setExchangeClientFactoryForTest(probe.factory);

    await placeOrders(
      [
        {
          asset: 0,
          isBuy: true,
          price: '95000',
          size: '0.01',
          reduceOnly: false,
          orderType: { limit: { tif: 'Gtc' } },
          cloid: 'abc',
        },
        {
          asset: 0,
          isBuy: false,
          price: '96000',
          size: '0.02',
          reduceOnly: false,
          orderType: { limit: { tif: 'Gtc' } },
        },
      ],
      '0xabc',
      '0xagent',
    );

    assert.equal(probe.calls[0].method, 'order');
    assert.equal(probe.calls[0].params.orders.length, 2);
    assert.equal(probe.calls[0].params.orders[0].c, 'abc');
  });

  it('passes custom grouping to exchange.order', async () => {
    const probe = createFactoryProbe();
    __setExchangeClientFactoryForTest(probe.factory);

    await placeOrders(
      [{
        asset: 0,
        isBuy: true,
        price: '95000',
        size: '0.01',
        reduceOnly: false,
        orderType: { limit: { tif: 'Gtc' } },
      }],
      '0xabc',
      '0xagent',
      { grouping: 'positionTpsl' },
    );

    assert.equal(probe.calls[0].params.grouping, 'positionTpsl');
  });

  it('maps cancelByCloid to exchange.cancelByCloid', async () => {
    const probe = createFactoryProbe();
    __setExchangeClientFactoryForTest(probe.factory);

    await cancelByCloid(0, 'c1', '0xabc', '0xagent', { isTestnet: true });

    assert.equal(probe.calls[0].method, 'cancelByCloid');
    assert.deepEqual(probe.calls[0].params, { cancels: [{ asset: 0, cloid: 'c1' }] });
    assert.equal(probe.factoryCalls[0].opts.isTestnet, true);
  });

  it('maps modifyOrder to exchange.modify', async () => {
    const probe = createFactoryProbe();
    __setExchangeClientFactoryForTest(probe.factory);

    await modifyOrder(
      123,
      {
        asset: 0,
        isBuy: true,
        price: '95000',
        size: '0.01',
        reduceOnly: false,
        orderType: { limit: { tif: 'Gtc' } },
        cloid: 'abc',
      },
      '0xabc',
      '0xagent',
    );

    assert.equal(probe.calls[0].method, 'modify');
    assert.equal(probe.calls[0].params.oid, 123);
    assert.equal(probe.calls[0].params.order.c, 'abc');
  });

  it('maps twapOrder to exchange.twapOrder', async () => {
    const probe = createFactoryProbe();
    __setExchangeClientFactoryForTest(probe.factory);

    await twapOrder(1, true, '0.1', false, 10, true, '0xabc', '0xagent');

    assert.equal(probe.calls[0].method, 'twapOrder');
    assert.deepEqual(probe.calls[0].params, {
      twap: { a: 1, b: true, s: '0.1', r: false, m: 10, t: true },
    });
  });

  it('maps twapCancel to exchange.twapCancel', async () => {
    const probe = createFactoryProbe();
    __setExchangeClientFactoryForTest(probe.factory);

    await twapCancel(1, 5, '0xabc', '0xagent');

    assert.equal(probe.calls[0].method, 'twapCancel');
    assert.deepEqual(probe.calls[0].params, { a: 1, t: 5 });
  });

  it('maps updateLeverage to exchange.updateLeverage', async () => {
    const probe = createFactoryProbe();
    __setExchangeClientFactoryForTest(probe.factory);

    await updateLeverage(1, true, 5, '0xabc', '0xagent');

    assert.equal(probe.calls[0].method, 'updateLeverage');
    assert.deepEqual(probe.calls[0].params, { asset: 1, isCross: true, leverage: 5 });
  });

  it('maps updateIsolatedMargin to exchange.updateIsolatedMargin', async () => {
    const probe = createFactoryProbe();
    __setExchangeClientFactoryForTest(probe.factory);

    await updateIsolatedMargin(1, true, 1_000_000, '0xabc', '0xagent');

    assert.equal(probe.calls[0].method, 'updateIsolatedMargin');
    assert.deepEqual(probe.calls[0].params, { asset: 1, isBuy: true, ntli: 1_000_000 });
  });

  it('maps approveBuilderFee to exchange.approveBuilderFee', async () => {
    const probe = createFactoryProbe();
    __setExchangeClientFactoryForTest(probe.factory);

    await approveBuilderFee('0.01%', '0x1234567890123456789012345678901234567890', '0xabc', '0xagent');

    assert.equal(probe.calls[0].method, 'approveBuilderFee');
    assert.deepEqual(probe.calls[0].params, {
      maxFeeRate: '0.01%',
      builder: '0x1234567890123456789012345678901234567890',
    });
  });

  it('maps usdClassTransfer to exchange.usdClassTransfer', async () => {
    const probe = createFactoryProbe();
    __setExchangeClientFactoryForTest(probe.factory);

    await usdClassTransfer('1', true, '0xabc', '0xuser', { isTestnet: true });

    assert.equal(probe.factoryCalls[0].opts.isTestnet, true);
    assert.equal(probe.calls[0].method, 'usdClassTransfer');
    assert.deepEqual(probe.calls[0].params, { amount: '1', toPerp: true });
  });
});
