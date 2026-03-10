import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { clearCachedPassword, loadCachedPassword, saveCachedPassword } from '../password-cache.mjs';

describe('password cache', () => {
  it('saves and loads cached password', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dpro-hl-pwd-cache-'));
    const cacheFile = join(dir, 'session.json');
    const env = { DPRO_HL_PASSWORD_CACHE_FILE: cacheFile, DPRO_HL_PASSWORD_CACHE: '1' };
    saveCachedPassword('secret', 1_000, env);
    assert.equal(loadCachedPassword(2_000, env), 'secret');
  });

  it('returns null and deletes file when cache expired', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dpro-hl-pwd-cache-'));
    const cacheFile = join(dir, 'session.json');
    const env = { DPRO_HL_PASSWORD_CACHE_FILE: cacheFile, DPRO_HL_PASSWORD_CACHE: '1', DPRO_HL_PASSWORD_CACHE_TTL_SEC: '1' };
    saveCachedPassword('secret', 1_000, env);
    assert.equal(loadCachedPassword(4_000, env), null);
    assert.equal(existsSync(cacheFile), false);
  });

  it('does not read or write when cache is disabled', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dpro-hl-pwd-cache-'));
    const cacheFile = join(dir, 'session.json');
    const env = { DPRO_HL_PASSWORD_CACHE_FILE: cacheFile, DPRO_HL_PASSWORD_CACHE: '0' };
    saveCachedPassword('secret', 1_000, env);
    assert.equal(loadCachedPassword(2_000, env), null);
    assert.equal(existsSync(cacheFile), false);
  });

  it('supports custom cache file path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dpro-hl-pwd-cache-'));
    const cacheFile = join(dir, 'custom.json');
    const env = { DPRO_HL_PASSWORD_CACHE_FILE: cacheFile, DPRO_HL_PASSWORD_CACHE: '1' };
    saveCachedPassword('secret', 1_000, env);
    assert.equal(existsSync(cacheFile), true);
    clearCachedPassword(env);
    assert.equal(existsSync(cacheFile), false);
  });
});
