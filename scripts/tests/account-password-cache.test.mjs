import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import account from '../commands/account.mjs';

describe('account clear-password-cache command', () => {
  it('returns success and clears cache file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dpro-hl-account-pwd-cache-'));
    const cacheFile = join(dir, 'password-session.json');
    writeFileSync(cacheFile, JSON.stringify({
      apiPassword: 'api-x',
      masterPassword: 'master-x',
      apiSavedAt: 1,
      masterSavedAt: 1,
      apiExpiresAt: Date.now() + 60_000,
      masterExpiresAt: Date.now() + 60_000,
    }), 'utf8');
    assert.equal(existsSync(cacheFile), true);

    const prevPath = process.env.DPRO_HL_PASSWORD_CACHE_FILE;
    process.env.DPRO_HL_PASSWORD_CACHE_FILE = cacheFile;
    try {
      const out = await account.clearPasswordCache({}, {});
      assert.equal(out.ok, true);
      assert.equal(out.type, 'password-cache-cleared');
      assert.equal(out.data.cleared, true);
      assert.equal(existsSync(cacheFile), false);
    } finally {
      if (prevPath == null) delete process.env.DPRO_HL_PASSWORD_CACHE_FILE;
      else process.env.DPRO_HL_PASSWORD_CACHE_FILE = prevPath;
    }
  });
});
