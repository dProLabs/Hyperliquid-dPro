import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import transfer, { __setTransferDepsForTest, __resetTransferDepsForTest } from '../commands/transfer.mjs';

function makeApiAccount() {
  return {
    alias: 'main',
    mode: 'api',
    masterAddress: '0x1234567890abcdef1234567890abcdef12345678',
    agentAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };
}

describe('transfer command', () => {
  afterEach(() => {
    __resetTransferDepsForTest();
  });

  it('uses default --to perp when omitted', async () => {
    let captured = null;
    __setTransferDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getMasterPrivateKeyByAddress: () => 'b'.repeat(64),
      exchangeClient: {
        usdClassTransfer: async (amount, toPerp) => {
          captured = { amount, toPerp };
          return { status: 'ok' };
        },
      },
    });

    const out = await transfer.transfer({ args: { usd: '10' }, flags: {} }, { network: 'mainnet' });
    assert.equal(out.ok, true);
    assert.equal(out.type, 'transfer_result');
    assert.equal(out.data.from, 'spot');
    assert.equal(out.data.to, 'perp');
    assert.deepEqual(captured, { amount: '10', toPerp: true });
  });

  it('supports --to spot', async () => {
    let captured = null;
    __setTransferDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getMasterPrivateKeyByAddress: () => 'b'.repeat(64),
      exchangeClient: {
        usdClassTransfer: async (amount, toPerp) => {
          captured = { amount, toPerp };
          return { status: 'ok' };
        },
      },
    });

    const out = await transfer.transfer({ args: { usd: '3.5' }, flags: { to: 'spot' } }, { network: 'mainnet' });
    assert.equal(out.data.from, 'perp');
    assert.equal(out.data.to, 'spot');
    assert.deepEqual(captured, { amount: '3.5', toPerp: false });
  });

  it('rejects invalid --to', async () => {
    __setTransferDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getMasterPrivateKeyByAddress: () => 'b'.repeat(64),
      exchangeClient: { usdClassTransfer: async () => ({ status: 'ok' }) },
    });
    await assert.rejects(
      () => transfer.transfer({ args: { usd: '1' }, flags: { to: 'futures' } }, {}),
      /must be "perp" or "spot"/i,
    );
  });

  it('rejects non-positive amount', async () => {
    __setTransferDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getMasterPrivateKeyByAddress: () => 'b'.repeat(64),
      exchangeClient: { usdClassTransfer: async () => ({ status: 'ok' }) },
    });
    await assert.rejects(
      () => transfer.transfer({ args: { usd: '0' }, flags: {} }, {}),
      /USD amount must be a positive number/i,
    );
  });

  it('fails when account is readonly', async () => {
    __setTransferDepsForTest({
      resolveAccount: () => ({ alias: 'ro', mode: 'readonly' }),
      getMasterPrivateKeyByAddress: () => 'b'.repeat(64),
      exchangeClient: { usdClassTransfer: async () => ({ status: 'ok' }) },
    });
    await assert.rejects(
      () => transfer.transfer({ args: { usd: '1' }, flags: {} }, {}),
      /read-only/i,
    );
  });

  it('surfaces missing master key migration hint', async () => {
    __setTransferDepsForTest({
      resolveAccount: () => makeApiAccount(),
      getMasterPrivateKeyByAddress: () => {
        const err = new Error('No private key for account: 0x1234567890abcdef1234567890abcdef12345678 (missing master key, run: dpro-hl account add-master <masterAddress> <masterPrivKey> --password <password>)');
        err.code = 'PRIVATE_KEY_MISSING';
        throw err;
      },
      exchangeClient: { usdClassTransfer: async () => ({ status: 'ok' }) },
    });
    await assert.rejects(
      () => transfer.transfer({ args: { usd: '1' }, flags: {} }, {}),
      /add-master/i,
    );
  });

  it('resolves master key by masterAddress even when alias differs', async () => {
    let capturedAddress = null;
    __setTransferDepsForTest({
      resolveAccount: () => ({
        alias: 'api-alias',
        mode: 'api',
        masterAddress: '0x9999999999999999999999999999999999999999',
      }),
      getMasterPrivateKeyByAddress: (address) => {
        capturedAddress = address;
        return 'b'.repeat(64);
      },
      exchangeClient: { usdClassTransfer: async () => ({ status: 'ok' }) },
    });

    const out = await transfer.transfer({ args: { usd: '1' }, flags: {} }, {});
    assert.equal(out.ok, true);
    assert.equal(capturedAddress, '0x9999999999999999999999999999999999999999');
  });
});
