import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { maybeAutoUpgrade, __resetAutoUpgradeForTest } from '../auto-upgrade.mjs';

function makeDeps(overrides = {}) {
  const calls = [];
  let state = {
    lastCheckAt: null,
    lastUpdateAt: null,
    lastSeenHead: null,
    provider: null,
    installMode: null,
    lastProviderCheckAt: null,
    lastClawhubCheckAt: null,
    lastClawhubUpdateAt: null,
    lastWarningHash: null,
    lastWarningAt: null,
  };

  const files = {
    '/tmp/skill/package.json': JSON.stringify({ name: 'hyperliquid-dpro' }),
    '/tmp/skill/.clawhub/lock.json': JSON.stringify({
      version: 1,
      skills: { 'hyperliquid-cli': { version: '1.0.3' } },
    }),
  };

  const deps = {
    env: {},
    now: () => 1_700_000_000_000,
    exists: (p) => p.endsWith('/.git') || p.endsWith('/package.json'),
    assertWritable: () => {},
    getSkillRootDir: () => '/tmp/skill',
    loadState: () => state,
    saveState: (next) => { state = { ...next }; },
    readFile: (path) => {
      if (Object.prototype.hasOwnProperty.call(files, path)) return files[path];
      throw new Error(`ENOENT: ${path}`);
    },
    exec: async (cmd, args) => {
      calls.push([cmd, ...args].join(' '));
      const joined = [cmd, ...args].join(' ');
      if (joined === 'git status --porcelain --untracked-files=no') return { stdout: '' };
      if (joined === 'git fetch --quiet origin') return { stdout: '' };
      if (joined === 'git rev-parse --abbrev-ref HEAD') return { stdout: 'main\n' };
      if (joined === 'git rev-parse HEAD') return { stdout: 'aaa\n' };
      if (joined === 'git rev-parse origin/main') return { stdout: 'aaa\n' };
      if (joined === 'git pull --ff-only origin main') return { stdout: '' };
      if (joined === 'npm install --silent') return { stdout: '' };
      if (joined === 'clawhub --version') return { stdout: 'clawhub 1.0.0\n' };
      if (joined === 'clawhub update hyperliquid-dpro') return { stdout: 'updated\n' };
      return { stdout: '' };
    },
    ...overrides,
  };

  return {
    deps,
    calls,
    getState: () => state,
    setState: (next) => { state = { ...state, ...next }; },
    setFile: (path, content) => { files[path] = content; },
  };
}

describe('auto-upgrade', () => {
  beforeEach(() => {
    __resetAutoUpgradeForTest();
  });

  it('uses git provider by default on git installs', async () => {
    const { deps } = makeDeps();
    const result = await maybeAutoUpgrade({}, deps);
    assert.equal(result.provider, 'git');
    assert.equal(result.installMode, 'git-clone');
    assert.equal(result.skippedReason, 'up-to-date');
  });

  it('runs fetch -> pull -> npm when remote is ahead', async () => {
    const { deps, calls } = makeDeps({
      exec: async (cmd, args) => {
        calls.push([cmd, ...args].join(' '));
        const joined = [cmd, ...args].join(' ');
        if (joined === 'git status --porcelain --untracked-files=no') return { stdout: '' };
        if (joined === 'git fetch --quiet origin') return { stdout: '' };
        if (joined === 'git rev-parse --abbrev-ref HEAD') return { stdout: 'main\n' };
        if (joined === 'git rev-parse HEAD') return { stdout: calls.includes('git pull --ff-only origin main') ? 'bbb\n' : 'aaa\n' };
        if (joined === 'git rev-parse origin/main') return { stdout: 'bbb\n' };
        if (joined === 'git pull --ff-only origin main') return { stdout: '' };
        if (joined === 'npm install --silent') return { stdout: '' };
        return { stdout: '' };
      },
    });

    const result = await maybeAutoUpgrade({}, deps);
    assert.equal(result.updated, true);
    assert.equal(calls.includes('git pull --ff-only origin main'), true);
    assert.equal(calls.includes('npm install --silent'), true);
  });

  it('routes to clawhub provider when .clawhub exists and .git is absent', async () => {
    const { deps, calls } = makeDeps({
      exists: (p) => p.endsWith('/package.json') || p.endsWith('/.clawhub/lock.json'),
    });

    const result = await maybeAutoUpgrade({}, deps);
    assert.equal(result.provider, 'clawhub');
    assert.equal(result.installMode, 'clawhub-managed');
    assert.equal(calls.includes('clawhub --version'), true);
    assert.equal(calls.includes('clawhub update hyperliquid-dpro'), true);
  });

  it('falls back to package name when lock skills key mismatches', async () => {
    const { deps, calls, setFile } = makeDeps({
      exists: (p) => p.endsWith('/package.json') || p.endsWith('/.clawhub/lock.json'),
    });
    setFile('/tmp/skill/.clawhub/lock.json', JSON.stringify({
      version: 1,
      skills: { other: { version: '1.0.0' } },
    }));

    await maybeAutoUpgrade({}, deps);
    assert.equal(calls.includes('clawhub update hyperliquid-dpro'), true);
  });

  it('supports custom clawhub command alias', async () => {
    const { deps, calls } = makeDeps({
      exists: (p) => p.endsWith('/package.json') || p.endsWith('/.clawhub/lock.json'),
      exec: async (cmd, args) => {
        calls.push([cmd, ...args].join(' '));
        if (cmd === 'openclaw' && args[0] === '--version') return { stdout: '1.0.0\n' };
        if (cmd === 'openclaw' && args[0] === 'update') return { stdout: 'updated\n' };
        return { stdout: '' };
      },
    });

    const result = await maybeAutoUpgrade({ autoUpgradeClawhubCmd: 'openclaw' }, deps);
    assert.equal(result.provider, 'clawhub');
    assert.equal(calls.includes('openclaw update hyperliquid-dpro'), true);
  });

  it('does not rerun clawhub update within check interval', async () => {
    const { deps, calls, setState } = makeDeps({
      exists: (p) => p.endsWith('/package.json') || p.endsWith('/.clawhub/lock.json'),
      now: () => 1_700_000_000_000,
    });
    setState({ lastClawhubCheckAt: 1_700_000_000_000 - 1000 });

    const result = await maybeAutoUpgrade({}, deps);
    assert.equal(result.skippedReason, 'check-interval');
    assert.equal(calls.length, 0);
  });

  it('supports provider off via env', async () => {
    const { deps, calls } = makeDeps({ env: { HL_AUTO_UPGRADE_PROVIDER: 'off' } });
    const result = await maybeAutoUpgrade({}, deps);
    assert.equal(result.skippedReason, 'disabled-provider');
    assert.equal(result.provider, 'none');
    assert.equal(calls.length, 0);
  });

  it('warns and continues when clawhub binary is missing', async () => {
    const { deps } = makeDeps({
      exists: (p) => p.endsWith('/package.json') || p.endsWith('/.clawhub/lock.json'),
      exec: async () => {
        throw new Error('spawn clawhub ENOENT');
      },
    });

    const result = await maybeAutoUpgrade({}, deps);
    assert.equal(result.provider, 'clawhub');
    assert.equal(result.skippedReason, 'failed');
    assert.match(result.warning || '', /Auto-upgrade failed/i);
  });

  it('returns timeout warning without blocking', async () => {
    const { deps } = makeDeps({
      now: (() => {
        let tick = 0;
        return () => {
          tick += 1200;
          return 1_700_000_000_000 + tick;
        };
      })(),
    });
    const result = await maybeAutoUpgrade({ autoUpgradeTimeoutMs: 500 }, deps);
    assert.equal(result.skippedReason, 'timeout');
    assert.match(result.warning || '', /timed out/i);
  });

  it('dedupes same warning within one hour', async () => {
    const { deps, getState } = makeDeps({
      exec: async () => {
        throw new Error('fetch failed');
      },
    });

    const first = await maybeAutoUpgrade({}, deps);
    __resetAutoUpgradeForTest();
    const second = await maybeAutoUpgrade({}, deps);

    assert.match(first.warning || '', /failed/i);
    assert.equal(second.warning, null);
    assert.ok(getState().lastWarningHash);
  });

  it('skips all commands when auto upgrade is disabled', async () => {
    const { deps, calls } = makeDeps();
    const result = await maybeAutoUpgrade({ autoUpgrade: false }, deps);
    assert.equal(result.skippedReason, 'disabled');
    assert.equal(result.provider, 'none');
    assert.equal(calls.length, 0);
  });
});
