import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  clearCachedPasswords,
  loadCachedApiPassword,
  loadCachedMasterPassword,
  saveCachedApiPassword,
  saveCachedMasterPassword,
} from '../password-cache.mjs';

describe('password cache', () => {
  it('saves and loads cached api/master passwords', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dpro-hl-pwd-cache-'));
    const cacheFile = join(dir, 'session.json');
    const env = { DPRO_HL_PASSWORD_CACHE_FILE: cacheFile, DPRO_HL_PASSWORD_CACHE: '1' };
    saveCachedApiPassword('api-secret', 1_000, env);
    saveCachedMasterPassword('master-secret', 1_000, env);
    assert.equal(loadCachedApiPassword(2_000, env), 'api-secret');
    assert.equal(loadCachedMasterPassword(2_000, env), 'master-secret');
  });

  it('returns null when cache expired', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dpro-hl-pwd-cache-'));
    const cacheFile = join(dir, 'session.json');
    const env = { DPRO_HL_PASSWORD_CACHE_FILE: cacheFile, DPRO_HL_PASSWORD_CACHE: '1', DPRO_HL_PASSWORD_CACHE_TTL_SEC: '1' };
    saveCachedApiPassword('api-secret', 1_000, env);
    saveCachedMasterPassword('master-secret', 1_000, env);
    assert.equal(loadCachedApiPassword(4_000, env), null);
    assert.equal(loadCachedMasterPassword(4_000, env), null);
  });

  it('does not read or write when cache is disabled', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dpro-hl-pwd-cache-'));
    const cacheFile = join(dir, 'session.json');
    const env = { DPRO_HL_PASSWORD_CACHE_FILE: cacheFile, DPRO_HL_PASSWORD_CACHE: '0' };
    saveCachedApiPassword('api-secret', 1_000, env);
    saveCachedMasterPassword('master-secret', 1_000, env);
    assert.equal(loadCachedApiPassword(2_000, env), null);
    assert.equal(loadCachedMasterPassword(2_000, env), null);
    assert.equal(existsSync(cacheFile), false);
  });

  it('supports custom cache file path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dpro-hl-pwd-cache-'));
    const cacheFile = join(dir, 'custom.json');
    const env = { DPRO_HL_PASSWORD_CACHE_FILE: cacheFile, DPRO_HL_PASSWORD_CACHE: '1' };
    saveCachedApiPassword('api-secret', 1_000, env);
    assert.equal(existsSync(cacheFile), true);
    clearCachedPasswords(env);
    assert.equal(existsSync(cacheFile), false);
  });
});
