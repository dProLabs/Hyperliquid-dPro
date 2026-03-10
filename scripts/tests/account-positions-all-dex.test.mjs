import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import account, { __setAccountDepsForTest, __resetAccountDepsForTest } from '../commands/account.mjs';

describe('account positions all-dex aggregation', () => {
  afterEach(() => {
    __resetAccountDepsForTest();
  });

  it('aggregates positions across main perp and HIP-3 dex states', async () => {
    const calls = [];

    __setAccountDepsForTest({
      resolveQueryAddress: () => '0x1234567890abcdef1234567890abcdef12345678',
      infoClient: {
        getAllPerpMetas: async () => ([
          { universe: [{ name: 'BTC' }] },
          { universe: [{ name: 'XYZ:NVDA' }] },
        ]),
        getClearinghouseState: async (_user, opts) => {
          calls.push(opts.dex ?? '');
          if ((opts.dex ?? '') === '') {
            return {
              assetPositions: [
                {
                  position: {
                    coin: 'BTC',
                    szi: '0.0004',
                    entryPx: '70118.5',
                    positionValue: '27.86',
                    unrealizedPnl: '-0.19',
                    leverage: { value: '5' },
                  },
                },
              ],
            };
          }
          return {
            assetPositions: [
              {
                position: {
                  coin: 'XYZ:TSLA',
                  szi: '0.05',
                  entryPx: '397.14',
                  positionValue: '19.82',
                  unrealizedPnl: '-0.04',
                  leverage: { value: '10' },
                },
              },
            ],
          };
        },
        getSpotClearinghouseState: async () => ({ balances: [] }),
      },
    });

    const out = await account.positions({ target: 'skill-test' }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'positions');
    assert.equal(out.data.positions.length, 2);
    assert.deepEqual(calls, ['', 'XYZ']);
    assert.equal(out.data.positions[0].coin, 'BTC');
    assert.equal(out.data.positions[1].coin, 'XYZ:TSLA');
  });
});
