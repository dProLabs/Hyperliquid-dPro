import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __resolveApiPasswordForTest, __resolveMasterPasswordForTest, __shouldClearPasswordCacheForTest } from '../entry.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ErrorCode, SkillError } from '../errors.mjs';

describe('entry password resolution', () => {
  it('resolves api password from --api-password first', () => {
    const out = __resolveApiPasswordForTest(
      { flags: { 'api-password': 'flag-api' } },
      { apiPassword: 'ctx-api' },
      { DPRO_HL_API_PASSWORD: 'env-api', DPRO_HL_PASSWORD_CACHE: '0' },
    );
    assert.equal(out, 'flag-api');
  });

  it('falls back to runtimeContext.apiPassword', () => {
    const out = __resolveApiPasswordForTest(
      { flags: {} },
      { apiPassword: 'ctx-api' },
      { DPRO_HL_API_PASSWORD: 'env-api', DPRO_HL_PASSWORD_CACHE: '0' },
    );
    assert.equal(out, 'ctx-api');
  });

  it('resolves master password from --master-password first', () => {
    assert.equal(
      __resolveMasterPasswordForTest(
        { flags: { 'master-password': 'flag-master' } },
        { masterPassword: 'ctx-master' },
        { DPRO_HL_MASTER_PASSWORD: 'env-master', DPRO_HL_PASSWORD_CACHE: '0' },
      ),
      'flag-master',
    );
    assert.equal(
      __resolveMasterPasswordForTest(
        { flags: {} },
        { masterPassword: 'ctx-master' },
        { DPRO_HL_MASTER_PASSWORD: 'env-master', DPRO_HL_PASSWORD_CACHE: '0' },
      ),
      'ctx-master',
    );
  });

  it('returns null when nothing is provided', () => {
    assert.equal(__resolveApiPasswordForTest({ flags: {} }, {}, { DPRO_HL_PASSWORD_CACHE: '0' }), null);
    assert.equal(__resolveMasterPasswordForTest({ flags: {} }, {}, { DPRO_HL_PASSWORD_CACHE: '0' }), null);
  });

  it('falls back to password cache file when explicit/runtime/env are empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dpro-hl-entry-pwd-'));
    const cacheFile = join(dir, 'password-session.json');
    writeFileSync(cacheFile, JSON.stringify({
      apiPassword: 'cached-api',
      masterPassword: 'cached-master',
      apiSavedAt: Date.now() - 1000,
      masterSavedAt: Date.now() - 1000,
      apiExpiresAt: Date.now() + 10_000,
      masterExpiresAt: Date.now() + 10_000,
    }), 'utf8');
    const apiOut = __resolveApiPasswordForTest(
      { flags: {} },
      {},
      { DPRO_HL_PASSWORD_CACHE_FILE: cacheFile, DPRO_HL_PASSWORD_CACHE: '1' },
    );
    const masterOut = __resolveMasterPasswordForTest(
      { flags: {} },
      {},
      { DPRO_HL_PASSWORD_CACHE_FILE: cacheFile, DPRO_HL_PASSWORD_CACHE: '1' },
    );
    assert.equal(apiOut, 'cached-api');
    assert.equal(masterOut, 'cached-master');
  });
});

describe('entry password-cache cleanup trigger', () => {
  it('clears cache on decryption/password errors', () => {
    assert.equal(
      __shouldClearPasswordCacheForTest(new SkillError(ErrorCode.ENCRYPTION_ERROR, 'Decryption failed: wrong password')),
      true,
    );
    assert.equal(
      __shouldClearPasswordCacheForTest(new SkillError(ErrorCode.PRIVATE_KEY_MISSING, 'Master password not set')),
      true,
    );
    assert.equal(
      __shouldClearPasswordCacheForTest(new SkillError(ErrorCode.INPUT_ERROR, 'invalid side')),
      false,
    );
  });
});
