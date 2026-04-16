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

  it('returns twap history rows', async () => {
    __setAccountDepsForTest({
      resolveQueryAddress: () => '0x1234567890abcdef1234567890abcdef12345678',
      infoClient: {
        getTwapHistory: async () => ([
          {
            time: 1710000000,
            twapId: 42,
            state: {
              coin: '@265',
              side: 'A',
              sz: '1.2',
              executedSz: '0.4',
              executedNtl: '32',
              minutes: 15,
              randomize: true,
              reduceOnly: false,
            },
            status: { status: 'activated' },
          },
        ]),
      },
      findMarket: async (coin) => (coin === '@265' ? { coin: 'TSLA' } : null),
    });

    const out = await account.twapHistory({ target: 'main', flags: { limit: '10' } }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'twap-history');
    assert.equal(out.data.items.length, 1);
    assert.equal(out.data.items[0].coin, 'TSLA');
    assert.equal(out.data.items[0].status, 'activated');
    assert.equal(out.data.items[0].side, 'Sell');
  });

  it('returns twap fill history rows', async () => {
    __setAccountDepsForTest({
      resolveQueryAddress: () => '0x1234567890abcdef1234567890abcdef12345678',
      infoClient: {
        getUserTwapSliceFills: async () => ([
          {
            twapId: 42,
            fill: {
              time: 1710000000000,
              coin: '@265',
              side: 'B',
              sz: '0.1',
              px: '80',
              fee: '-0.01',
              oid: 999,
            },
          },
        ]),
      },
      findMarket: async (coin) => (coin === '@265' ? { coin: 'TSLA' } : null),
    });

    const out = await account.twapFillHistory({ target: 'main', flags: { limit: '5' } }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'twap-fill-history');
    assert.equal(out.data.fills.length, 1);
    assert.equal(out.data.fills[0].coin, 'TSLA');
    assert.equal(out.data.fills[0].twapId, 42);
  });
});
