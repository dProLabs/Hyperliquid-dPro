import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __resolvePasswordForTest } from '../entry.mjs';

describe('entry password resolution', () => {
  it('uses --password flag first', () => {
    const out = __resolvePasswordForTest(
      { flags: { password: 'flag-pwd' } },
      { password: 'ctx-pwd' },
      { DPRO_HL_MASTER_PASSWORD: 'env-pwd', MASTER_PASSWORD: 'env2-pwd' },
    );
    assert.equal(out, 'flag-pwd');
  });

  it('falls back to runtimeContext.password', () => {
    const out = __resolvePasswordForTest(
      { flags: {} },
      { password: 'ctx-pwd' },
      { DPRO_HL_MASTER_PASSWORD: 'env-pwd' },
    );
    assert.equal(out, 'ctx-pwd');
  });

  it('falls back to DPRO_HL_MASTER_PASSWORD then MASTER_PASSWORD', () => {
    assert.equal(
      __resolvePasswordForTest({ flags: {} }, {}, { DPRO_HL_MASTER_PASSWORD: 'env-pwd', MASTER_PASSWORD: 'env2-pwd' }),
      'env-pwd',
    );
    assert.equal(
      __resolvePasswordForTest({ flags: {} }, {}, { MASTER_PASSWORD: 'env2-pwd' }),
      'env2-pwd',
    );
  });

  it('returns null when nothing is provided', () => {
    assert.equal(__resolvePasswordForTest({ flags: {} }, {}, {}), null);
  });
});
