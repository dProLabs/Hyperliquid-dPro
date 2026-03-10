import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __migrateV2ToV3ForTest, __normalizeMasterAddressKeyForTest } from '../store.mjs';

describe('store keys schema migration helpers', () => {
  it('normalizes master address key to lowercase', () => {
    const out = __normalizeMasterAddressKeyForTest('0xAbCdEf1234567890abcdef1234567890ABCDef12');
    assert.equal(out, '0xabcdef1234567890abcdef1234567890abcdef12');
  });

  it('rejects invalid master address format', () => {
    assert.throws(
      () => __normalizeMasterAddressKeyForTest('0x1234'),
      /Invalid master address/i,
    );
  });

  it('migrates v2 keys into v3 address map', () => {
    const parsedV2 = {
      schemaVersion: 2,
      accounts: {
        main: { agentPrivateKey: 'agent-a', masterPrivateKey: 'master-k' },
      },
    };
    const configAccounts = [
      { alias: 'main', masterAddress: '0x1234567890abcdef1234567890abcdef12345678' },
    ];

    const out = __migrateV2ToV3ForTest(parsedV2, configAccounts);
    assert.equal(out.schemaVersion, 3);
    assert.equal(out.accounts.main.agentPrivateKey, 'agent-a');
    assert.equal(out.masterKeysByAddress['0x1234567890abcdef1234567890abcdef12345678'], 'master-k');
  });

  it('throws when v2 alias has master key but config lacks masterAddress', () => {
    const parsedV2 = {
      schemaVersion: 2,
      accounts: {
        main: { masterPrivateKey: 'master-k' },
      },
    };
    assert.throws(
      () => __migrateV2ToV3ForTest(parsedV2, []),
      /Cannot migrate master key for alias/i,
    );
  });

  it('throws on conflicting master keys for same masterAddress', () => {
    const parsedV2 = {
      schemaVersion: 2,
      accounts: {
        a1: { masterPrivateKey: 'key-1' },
        a2: { masterPrivateKey: 'key-2' },
      },
    };
    const configAccounts = [
      { alias: 'a1', masterAddress: '0x1234567890abcdef1234567890abcdef12345678' },
      { alias: 'a2', masterAddress: '0x1234567890abcdef1234567890abcdef12345678' },
    ];
    assert.throws(
      () => __migrateV2ToV3ForTest(parsedV2, configAccounts),
      /Master key conflict during migration/i,
    );
  });
});
