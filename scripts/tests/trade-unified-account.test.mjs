import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import trade, { __setTradeDepsForTest, __resetTradeDepsForTest } from '../commands/trade.mjs';

function makeApiAccount() {
  return {
    alias: 'skill-test',
    mode: 'api',
    masterAddress: '0x1234567890abcdef1234567890abcdef12345678',
    agentAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };
}

describe('trade unified-account style behavior', () => {
  afterEach(() => {
    __resetTradeDepsForTest();
  });

  it('does not pre-block perp market order before venue rejection', async () => {
    let placeOrderCalls = 0;
    __setTradeDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getAgentPrivateKey: () => 'b'.repeat(64),
      resolveAsset: async () => ({ asset: 1, coin: 'BTC', kind: 'perp', szDecimals: 3 }),
      findRelatedSymbols: async () => [],
      findMarket: async () => null,
      infoClient: {
        getAllMids: async () => ({ BTC: '70000' }),
      },
      exchangeClient: {
        placeOrder: async () => {
          placeOrderCalls += 1;
          return { statuses: [{ error: 'Insufficient margin' }] };
        },
      },
    });

    const out = await trade.market({
      marketType: 'perp',
      target: 'BTC',
      args: { side: 'buy', size: '0.001' },
      flags: { slippage: '0.5' },
    }, { network: 'mainnet' });

    assert.equal(placeOrderCalls, 1);
    assert.equal(out.data.status, 'error');
    assert.equal(out.data.errorClass, 'INSUFFICIENT_MARGIN');
    assert.ok((out.warnings || []).some((w) => w.includes('insufficient balance or margin')));
  });
});
