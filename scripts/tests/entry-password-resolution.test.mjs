import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __resolvePasswordForTest, __shouldClearPasswordCacheForTest } from '../entry.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ErrorCode, SkillError } from '../errors.mjs';

describe('entry password resolution', () => {
  it('uses --password flag first', () => {
    const out = __resolvePasswordForTest(
      { flags: { password: 'flag-pwd' } },
      { password: 'ctx-pwd' },
      { DPRO_HL_MASTER_PASSWORD: 'env-pwd', MASTER_PASSWORD: 'env2-pwd', DPRO_HL_PASSWORD_CACHE: '0' },
    );
    assert.equal(out, 'flag-pwd');
  });

  it('falls back to runtimeContext.password', () => {
    const out = __resolvePasswordForTest(
      { flags: {} },
      { password: 'ctx-pwd' },
      { DPRO_HL_MASTER_PASSWORD: 'env-pwd', DPRO_HL_PASSWORD_CACHE: '0' },
    );
    assert.equal(out, 'ctx-pwd');
  });

  it('falls back to DPRO_HL_MASTER_PASSWORD then MASTER_PASSWORD', () => {
    assert.equal(
      __resolvePasswordForTest({ flags: {} }, {}, { DPRO_HL_MASTER_PASSWORD: 'env-pwd', MASTER_PASSWORD: 'env2-pwd', DPRO_HL_PASSWORD_CACHE: '0' }),
      'env-pwd',
    );
    assert.equal(
      __resolvePasswordForTest({ flags: {} }, {}, { MASTER_PASSWORD: 'env2-pwd', DPRO_HL_PASSWORD_CACHE: '0' }),
      'env2-pwd',
    );
  });

  it('returns null when nothing is provided', () => {
    assert.equal(__resolvePasswordForTest({ flags: {} }, {}, { DPRO_HL_PASSWORD_CACHE: '0' }), null);
  });

  it('falls back to password cache file when explicit/runtime/env are empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dpro-hl-entry-pwd-'));
    const cacheFile = join(dir, 'password-session.json');
    writeFileSync(cacheFile, JSON.stringify({
      password: 'cached-pwd',
      savedAt: Date.now() - 1000,
      expiresAt: Date.now() + 10_000,
    }), 'utf8');
    const out = __resolvePasswordForTest(
      { flags: {} },
      {},
      { DPRO_HL_PASSWORD_CACHE_FILE: cacheFile, DPRO_HL_PASSWORD_CACHE: '1' },
    );
    assert.equal(out, 'cached-pwd');
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
