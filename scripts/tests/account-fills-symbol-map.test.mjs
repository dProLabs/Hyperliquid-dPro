import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import account, { __setAccountDepsForTest, __resetAccountDepsForTest } from '../commands/account.mjs';

describe('account fills symbol mapping', () => {
  afterEach(() => {
    __resetAccountDepsForTest();
  });

  it('maps spot token index coin (@N) to display symbol', async () => {
    __setAccountDepsForTest({
      resolveQueryAddress: () => '0x1234567890abcdef1234567890abcdef12345678',
      infoClient: {
        getUserFills: async () => ([
          { time: 1, coin: '@265', side: 'B', sz: '0.2', px: '80.562', fee: '0.00', oid: 1 },
          { time: 2, coin: 'XYZ:TSLA', side: 'S', sz: '0.05', px: '397.14', fee: '0.01', oid: 2 },
        ]),
      },
      findMarket: async (coin) => {
        if (coin === '@265') return { coin: 'TSLA', apiName: '@265', type: 'spot' };
        return null;
      },
    });

    const out = await account.fills({ target: 'skill-test', flags: { limit: '5' } }, { network: 'mainnet' });

    assert.equal(out.ok, true);
    assert.equal(out.type, 'fills');
    assert.equal(out.data.fills.length, 2);
    assert.equal(out.data.fills[0].coin, 'TSLA');
    assert.equal(out.data.fills[1].coin, 'XYZ:TSLA');
  });
});
