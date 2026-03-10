import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { runHyperliquidSkill, __setAutoUpgradeForTest } from '../entry.mjs';

describe('entry auto-upgrade integration', () => {
  afterEach(() => {
    __setAutoUpgradeForTest(null);
  });

  it('continues command execution when auto-upgrade reports failure warning', async () => {
    __setAutoUpgradeForTest(async () => ({
      attempted: true,
      updated: false,
      skippedReason: 'failed',
      warning: 'Auto-upgrade failed: network issue',
    }));

    const output = await runHyperliquidSkill('dpro-hl');
    assert.match(output, /Hyperliquid-dPro/);
    assert.match(output, /Warnings:/);
    assert.match(output, /Auto-upgrade failed/i);
  });

  it('can skip auto-upgrade when runtimeContext disables it', async () => {
    let called = 0;
    __setAutoUpgradeForTest(async (runtimeContext) => {
      called += 1;
      assert.equal(runtimeContext.autoUpgrade, false);
      return { attempted: false, updated: false, skippedReason: 'disabled', warning: null };
    });

    const output = await runHyperliquidSkill('dpro-hl', { autoUpgrade: false });
    assert.match(output, /Hyperliquid-dPro/);
    assert.equal(called, 1);
  });

  it('preserves json mode output shape while including warnings', async () => {
    __setAutoUpgradeForTest(async () => ({
      attempted: true,
      updated: false,
      skippedReason: 'timeout',
      warning: 'Auto-upgrade timed out; command execution continues.',
    }));

    const output = await runHyperliquidSkill('dpro-hl --json');
    const parsed = JSON.parse(output);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.type, 'help');
    assert.ok(Array.isArray(parsed.warnings));
    assert.match(parsed.warnings[0], /timed out/i);
  });

  it('includes clawhub provider warning in text mode', async () => {
    __setAutoUpgradeForTest(async () => ({
      attempted: true,
      updated: false,
      skippedReason: 'failed',
      provider: 'clawhub',
      installMode: 'clawhub-managed',
      warning: 'Auto-upgrade failed: spawn clawhub ENOENT',
    }));

    const output = await runHyperliquidSkill('dpro-hl');
    assert.match(output, /Warnings:/);
    assert.match(output, /clawhub ENOENT/i);
  });
});
