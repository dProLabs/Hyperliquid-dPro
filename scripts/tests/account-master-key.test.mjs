import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import account, { __setAccountDepsForTest, __resetAccountDepsForTest } from '../commands/account.mjs';

const MASTER = '0x1234567890abcdef1234567890abcdef12345678';

describe('account master key commands', () => {
  afterEach(() => {
    __resetAccountDepsForTest();
  });

  it('adds master key by masterAddress', async () => {
    const calls = [];
    __setAccountDepsForTest({
      assertAddress: (v) => v,
      assertPrivateKey: (k) => k.replace(/^0x/, ''),
      store: {
        setMasterPassword: () => {},
        getMasterPassword: () => 'pwd',
        addMasterPrivateKeyByAddress: (masterAddress, key) => calls.push(['add', masterAddress, key]),
      },
    });

    const out = await account.addMaster(
      { target: MASTER, args: { rest: ['0x' + 'a'.repeat(64)] }, flags: {} },
      { masterPassword: 'pwd' },
    );
    assert.equal(out.ok, true);
    assert.equal(out.type, 'master-key-added');
    assert.equal(out.data.masterAddress, MASTER);
    assert.deepEqual(calls, [['add', MASTER, 'a'.repeat(64)]]);
  });

  it('updates master key by masterAddress', async () => {
    const calls = [];
    __setAccountDepsForTest({
      assertAddress: (v) => v,
      assertPrivateKey: (k) => k.replace(/^0x/, ''),
      store: {
        setMasterPassword: () => {},
        getMasterPassword: () => 'pwd',
        updateMasterPrivateKeyByAddress: (masterAddress, key) => calls.push(['update', masterAddress, key]),
      },
    });

    const out = await account.updateMaster(
      { target: MASTER, args: { rest: ['0x' + 'b'.repeat(64)] }, flags: {} },
      { masterPassword: 'pwd' },
    );
    assert.equal(out.type, 'master-key-updated');
    assert.equal(out.data.masterAddress, MASTER);
    assert.deepEqual(calls, [['update', MASTER, 'b'.repeat(64)]]);
  });

  it('removes master key by masterAddress', async () => {
    const calls = [];
    __setAccountDepsForTest({
      assertAddress: (v) => v,
      store: {
        setMasterPassword: () => {},
        getMasterPassword: () => 'pwd',
        removeMasterPrivateKeyByAddress: (masterAddress) => calls.push(['remove', masterAddress]),
      },
    });

    const out = await account.removeMaster(
      { target: MASTER, args: { rest: [] }, flags: {} },
      { masterPassword: 'pwd' },
    );
    assert.equal(out.type, 'master-key-removed');
    assert.equal(out.data.masterAddress, MASTER);
    assert.deepEqual(calls, [['remove', MASTER]]);
  });

  it('rejects when password is missing', async () => {
    __setAccountDepsForTest({
      assertAddress: (v) => v,
      assertPrivateKey: (k) => k,
      store: {
        setMasterPassword: () => {},
        getMasterPassword: () => null,
      },
    });

    await assert.rejects(
      () => account.addMaster({ target: MASTER, args: { rest: ['0x' + 'a'.repeat(64)] }, flags: {} }, {}),
      /Master wallet password required/i,
    );
  });

  it('rejects when masterAddress is invalid', async () => {
    __setAccountDepsForTest({
      assertAddress: () => {
        throw new Error('bad address');
      },
      assertPrivateKey: (k) => k,
      store: {
        setMasterPassword: () => {},
        getMasterPassword: () => 'pwd',
      },
    });

    await assert.rejects(
      () => account.addMaster({ target: 'not-an-address', args: { rest: ['0x' + 'a'.repeat(64)] }, flags: {} }, { masterPassword: 'pwd' }),
      /bad address/i,
    );
  });

  it('ls computes hasMasterKey by address mapping', async () => {
    __setAccountDepsForTest({
      store: {
        listAccounts: () => ([
          {
            alias: 'a1',
            masterAddress: MASTER,
            agentAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            mode: 'api',
            isDefault: true,
          },
          { alias: 'a2', masterAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', mode: 'readonly', isDefault: false },
        ]),
        hasMasterPrivateKeyByAddress: (address) => address.toLowerCase() === MASTER.toLowerCase(),
      },
    });

    const out = await account.ls({}, {});
    assert.equal(out.data.accounts[0].hasMasterKey, true);
    assert.equal(out.data.accounts[1].hasMasterKey, false);
    assert.equal(out.data.accounts[0].agentAddress, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    assert.equal(out.data.accounts[1].agentAddress, null);
  });
});
