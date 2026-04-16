import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import account, { __setAccountDepsForTest, __resetAccountDepsForTest } from '../commands/account.mjs';

describe('account history commands', () => {
  afterEach(() => {
    __resetAccountDepsForTest();
  });

  it('returns mapped order history rows', async () => {
    __setAccountDepsForTest({
      resolveQueryAddress: () => '0x1234567890abcdef1234567890abcdef12345678',
      infoClient: {
        getHistoricalOrders: async () => ([
          {
            status: 'filled',
            statusTimestamp: 1710000000000,
            order: {
              oid: 123,
              coin: '@265',
              side: 'B',
              sz: '0.2',
              limitPx: '80.562',
            },
          },
        ]),
      },
      findMarket: async (coin) => (coin === '@265' ? { coin: 'TSLA' } : null),
    });

    const out = await account.orderHistory({ target: 'main', flags: { limit: '5' } }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'order-history');
    assert.equal(out.data.orders.length, 1);
    assert.equal(out.data.orders[0].coin, 'TSLA');
    assert.equal(out.data.orders[0].status, 'filled');
  });

  it('returns funding history rows with filters', async () => {
    let captured = null;
    __setAccountDepsForTest({
      resolveQueryAddress: () => '0x1234567890abcdef1234567890abcdef12345678',
      infoClient: {
        getUserFunding: async (_user, startTime, endTime) => {
          captured = { startTime, endTime };
          return [
            {
              time: 1710000000000,
              hash: '0xabc',
              delta: {
                coin: 'BTC',
                usdc: '-12.3',
                szi: '0.01',
                fundingRate: '0.0001',
              },
            },
          ];
        },
      },
    });

    const out = await account.fundingHistory({
      target: 'main',
      flags: { 'start-time': '1', 'end-time': '2', limit: '5' },
    }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'funding-history');
    assert.equal(out.data.items.length, 1);
    assert.equal(out.data.items[0].coin, 'BTC');
    assert.deepEqual(captured, { startTime: 1, endTime: 2 });
  });
});
