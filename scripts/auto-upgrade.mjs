import { accessSync, existsSync, constants, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { loadUpgradeState, saveUpgradeState } from './config.mjs';
import { DEFAULT_AUTO_UPGRADE_INTERVAL_MS } from './constants.mjs';

const DEFAULT_TIMEOUT_MS = 2000;
const WARNING_DEDUPE_WINDOW_MS = 60 * 60 * 1000;

let inFlightUpgrade = null;

function runExecFile(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, options, (err, stdout, stderr) => {
      if (err) {
        reject(Object.assign(err, { stdout, stderr }));
        return;
      }
      resolve({ stdout: stdout || '', stderr: stderr || '' });
    });
    if (!child) reject(new Error(`Failed to execute: ${cmd}`));
  });
}

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function normalizeProvider(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return 'auto';
  if (v === 'off') return 'off';
  if (v === 'git') return 'git';
  if (v === 'clawhub') return 'clawhub';
  return 'auto';
}

function isEnabled(runtimeContext, env) {
  if (runtimeContext.autoUpgrade === false) return false;
  if (String(env.HL_AUTO_UPGRADE || '').trim() === '0') return false;
  return true;
}

function makeWarningHash(message) {
  return createHash('sha1').update(message).digest('hex');
}

function resolveUpgradeWarning(message, state, nowMs) {
  const hash = makeWarningHash(message);
  if (
    hash === state.lastWarningHash
    && Number.isFinite(state.lastWarningAt)
    && nowMs - state.lastWarningAt < WARNING_DEDUPE_WINDOW_MS
  ) {
    return { warning: null, hash, warningAt: state.lastWarningAt };
  }
  return { warning: message, hash, warningAt: nowMs };
}

function getSkillRootDir() {
  const thisFile = fileURLToPath(import.meta.url);
  return dirname(dirname(thisFile));
}

function readJsonFile(filePath, deps) {
  try {
    return JSON.parse(deps.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function detectInstallMode(skillRoot, deps) {
  if (deps.exists(join(skillRoot, '.git'))) {
    return 'git-clone';
  }
  if (deps.exists(join(skillRoot, '.clawhub', 'lock.json'))) {
    return 'clawhub-managed';
  }
  return 'unknown';
}

function resolveProvider(runtimeContext, deps, installMode) {
  const providerSetting = normalizeProvider(
    runtimeContext.autoUpgradeProvider ?? deps.env.HL_AUTO_UPGRADE_PROVIDER,
  );

  if (providerSetting === 'off') return 'off';
  if (providerSetting === 'git' || providerSetting === 'clawhub') return providerSetting;

  if (installMode === 'git-clone') return 'git';
  if (installMode === 'clawhub-managed') return 'clawhub';
  return 'none';
}

async function execStep(deps, skillRoot, command, args, startedAtMs, timeoutMs) {
  const elapsed = deps.now() - startedAtMs;
  const remaining = timeoutMs - elapsed;
  if (remaining <= 0) {
    const err = new Error('Auto-upgrade timed out');
    err.code = 'AUTO_UPGRADE_TIMEOUT';
    throw err;
  }
  return deps.exec(command, args, { cwd: skillRoot, timeout: remaining, maxBuffer: 1024 * 1024 });
}

function withState(baseState, patch, nowMs) {
  return {
    ...baseState,
    ...patch,
    lastCheckAt: nowMs,
    lastProviderCheckAt: nowMs,
  };
}

function finalizeWarningResult(result, message, state, deps, extraState = {}) {
  const nowMs = deps.now();
  const warningMeta = resolveUpgradeWarning(message, state, nowMs);
  deps.saveState(withState(state, {
    ...extraState,
    lastWarningHash: warningMeta.hash,
    lastWarningAt: warningMeta.warningAt,
  }, nowMs));
  return {
    ...result,
    warning: warningMeta.warning,
  };
}

function resolveSkillSlugFromLock(lockData, packageName) {
  if (!lockData || typeof lockData !== 'object') return packageName;
  const skills = lockData.skills;
  if (!skills || typeof skills !== 'object') return packageName;
  if (packageName && Object.prototype.hasOwnProperty.call(skills, packageName)) return packageName;
  return packageName;
}

async function runGitUpgrade(runtimeContext, deps, state, skillRoot, installMode, timeoutMs) {
  const result = {
    attempted: false,
    updated: false,
    skippedReason: null,
    warning: null,
    provider: 'git',
    installMode,
  };

  const gitDir = join(skillRoot, '.git');
  const packageJsonPath = join(skillRoot, 'package.json');

  if (!deps.exists(gitDir)) {
    return { ...result, skippedReason: 'not-a-git-install' };
  }
  if (!deps.exists(packageJsonPath)) {
    return { ...result, skippedReason: 'missing-package-json' };
  }

  try {
    deps.assertWritable(skillRoot);
  } catch {
    return finalizeWarningResult(
      { ...result, skippedReason: 'not-writable' },
      'Auto-upgrade skipped: skill directory is not writable.',
      state,
      deps,
      { provider: 'git', installMode },
    );
  }

  const startedAtMs = deps.now();
  const dryRun = runtimeContext.autoUpgradeDryRun === true;
  const disableNpmInstall = runtimeContext.autoUpgradeDisableNpmInstall === true
    || String(deps.env.HL_AUTO_UPGRADE_DISABLE_NPM || '').trim() === '1';

  try {
    const status = await execStep(deps, skillRoot, 'git', ['status', '--porcelain', '--untracked-files=no'], startedAtMs, timeoutMs);
    if (status.stdout.trim()) {
      return finalizeWarningResult(
        { ...result, skippedReason: 'dirty-worktree' },
        'Auto-upgrade skipped: local git changes detected.',
        state,
        deps,
        { provider: 'git', installMode },
      );
    }

    await execStep(deps, skillRoot, 'git', ['fetch', '--quiet', 'origin'], startedAtMs, timeoutMs);
    const branchRes = await execStep(deps, skillRoot, 'git', ['rev-parse', '--abbrev-ref', 'HEAD'], startedAtMs, timeoutMs);
    const branch = branchRes.stdout.trim();
    if (!branch || branch === 'HEAD') {
      return finalizeWarningResult(
        { ...result, attempted: true, skippedReason: 'detached-head' },
        'Auto-upgrade skipped: detached HEAD is not supported.',
        state,
        deps,
        { provider: 'git', installMode },
      );
    }

    const localHeadRes = await execStep(deps, skillRoot, 'git', ['rev-parse', 'HEAD'], startedAtMs, timeoutMs);
    const remoteHeadRes = await execStep(deps, skillRoot, 'git', ['rev-parse', `origin/${branch}`], startedAtMs, timeoutMs);
    const localHead = localHeadRes.stdout.trim();
    const remoteHead = remoteHeadRes.stdout.trim();
    const preparedState = withState(state, {
      provider: 'git',
      installMode,
      lastSeenHead: remoteHead || localHead,
    }, deps.now());

    if (!remoteHead || localHead === remoteHead) {
      deps.saveState(preparedState);
      return { ...result, attempted: true, skippedReason: 'up-to-date' };
    }

    if (dryRun) {
      deps.saveState(preparedState);
      return { ...result, attempted: true, skippedReason: 'dry-run' };
    }

    await execStep(deps, skillRoot, 'git', ['pull', '--ff-only', 'origin', branch], startedAtMs, timeoutMs);
    if (!disableNpmInstall) {
      await execStep(deps, skillRoot, 'npm', ['install', '--silent'], startedAtMs, timeoutMs);
    }

    const updatedHeadRes = await execStep(deps, skillRoot, 'git', ['rev-parse', 'HEAD'], startedAtMs, timeoutMs);
    deps.saveState(withState(preparedState, {
      lastUpdateAt: deps.now(),
      lastSeenHead: updatedHeadRes.stdout.trim() || remoteHead,
    }, deps.now()));

    return { ...result, attempted: true, updated: true };
  } catch (err) {
    const message = err?.code === 'AUTO_UPGRADE_TIMEOUT'
      ? 'Auto-upgrade timed out; command execution continues.'
      : `Auto-upgrade failed: ${err.message}`;
    return finalizeWarningResult(
      { ...result, attempted: true, skippedReason: err?.code === 'AUTO_UPGRADE_TIMEOUT' ? 'timeout' : 'failed' },
      message,
      state,
      deps,
      { provider: 'git', installMode },
    );
  }
}

function isLikelyUpToDateOutput(output) {
  return /(already\s+up[- ]?to[- ]?date|already\s+latest|up[- ]?to[- ]?date|no\s+updates?)/i.test(output);
}

async function runClawhubUpgrade(runtimeContext, deps, state, skillRoot, installMode, timeoutMs) {
  const result = {
    attempted: false,
    updated: false,
    skippedReason: null,
    warning: null,
    provider: 'clawhub',
    installMode,
  };

  const packageJsonPath = join(skillRoot, 'package.json');
  if (!deps.exists(packageJsonPath)) {
    return { ...result, skippedReason: 'missing-package-json' };
  }

  const intervalMs = parsePositiveInt(
    runtimeContext.autoUpgradeCheckIntervalMs ?? deps.env.HL_AUTO_UPGRADE_CHECK_INTERVAL_MS,
    DEFAULT_AUTO_UPGRADE_INTERVAL_MS,
  );
  const nowMs = deps.now();
  if (Number.isFinite(state.lastClawhubCheckAt) && nowMs - state.lastClawhubCheckAt < intervalMs) {
    return {
      ...result,
      skippedReason: 'check-interval',
    };
  }

  const clawhubCmd = String(
    runtimeContext.autoUpgradeClawhubCmd
      ?? deps.env.HL_AUTO_UPGRADE_CLAWHUB_CMD
      ?? 'clawhub',
  ).trim() || 'clawhub';
  const startedAtMs = deps.now();

  try {
    deps.assertWritable(skillRoot);
  } catch {
    return finalizeWarningResult(
      { ...result, skippedReason: 'not-writable' },
      'Auto-upgrade skipped: skill directory is not writable.',
      state,
      deps,
      { provider: 'clawhub', installMode, lastClawhubCheckAt: deps.now() },
    );
  }

  try {
    await execStep(deps, skillRoot, clawhubCmd, ['--version'], startedAtMs, timeoutMs);

    const packageJson = readJsonFile(packageJsonPath, deps) || {};
    const packageName = typeof packageJson.name === 'string' ? packageJson.name : 'hyperliquid-dpro';
    const lockData = readJsonFile(join(skillRoot, '.clawhub', 'lock.json'), deps);
    const skillSlug = resolveSkillSlugFromLock(lockData, packageName);

    const updateRes = await execStep(deps, skillRoot, clawhubCmd, ['update', skillSlug], startedAtMs, timeoutMs);
    const output = `${updateRes.stdout || ''}\n${updateRes.stderr || ''}`;

    const commonState = withState(state, {
      provider: 'clawhub',
      installMode,
      lastClawhubCheckAt: deps.now(),
    }, deps.now());

    if (isLikelyUpToDateOutput(output)) {
      deps.saveState(commonState);
      return { ...result, attempted: true, skippedReason: 'up-to-date' };
    }

    deps.saveState(withState(commonState, {
      lastUpdateAt: deps.now(),
      lastClawhubUpdateAt: deps.now(),
    }, deps.now()));
    return { ...result, attempted: true, updated: true };
  } catch (err) {
    const message = err?.code === 'AUTO_UPGRADE_TIMEOUT'
      ? 'Auto-upgrade timed out; command execution continues.'
      : `Auto-upgrade failed: ${err.message}`;
    return finalizeWarningResult(
      { ...result, attempted: true, skippedReason: err?.code === 'AUTO_UPGRADE_TIMEOUT' ? 'timeout' : 'failed' },
      message,
      state,
      deps,
      { provider: 'clawhub', installMode, lastClawhubCheckAt: deps.now() },
    );
  }
}

async function runUpgrade(runtimeContext, deps) {
  const skillRoot = deps.getSkillRootDir();
  const installMode = detectInstallMode(skillRoot, deps);
  const provider = resolveProvider(runtimeContext, deps, installMode);
  const timeoutMs = parsePositiveInt(
    runtimeContext.autoUpgradeTimeoutMs ?? deps.env.HL_AUTO_UPGRADE_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );
  const state = deps.loadState();

  if (provider === 'off') {
    return {
      attempted: false,
      updated: false,
      skippedReason: 'disabled-provider',
      warning: null,
      provider: 'none',
      installMode,
    };
  }

  if (provider === 'git') {
    return runGitUpgrade(runtimeContext, deps, state, skillRoot, installMode, timeoutMs);
  }
  if (provider === 'clawhub') {
    return runClawhubUpgrade(runtimeContext, deps, state, skillRoot, installMode, timeoutMs);
  }

  deps.saveState(withState(state, {
    provider: 'none',
    installMode,
  }, deps.now()));
  return {
    attempted: false,
    updated: false,
    skippedReason: 'unsupported-install-mode',
    warning: null,
    provider: 'none',
    installMode,
  };
}

function buildDeps(overrides = {}) {
  return {
    env: process.env,
    now: () => Date.now(),
    exists: existsSync,
    assertWritable: (path) => accessSync(path, constants.W_OK),
    readFile: readFileSync,
    exec: runExecFile,
    loadState: loadUpgradeState,
    saveState: saveUpgradeState,
    getSkillRootDir,
    ...overrides,
  };
}

export async function maybeAutoUpgrade(runtimeContext = {}, depsOverrides = {}) {
  const deps = buildDeps(depsOverrides);
  if (!isEnabled(runtimeContext, deps.env)) {
    return {
      attempted: false,
      updated: false,
      skippedReason: 'disabled',
      warning: null,
      provider: 'none',
      installMode: 'unknown',
    };
  }

  if (!inFlightUpgrade) {
    inFlightUpgrade = runUpgrade(runtimeContext, deps).finally(() => {
      inFlightUpgrade = null;
    });
  }
  return inFlightUpgrade;
}

export function __resetAutoUpgradeForTest() {
  inFlightUpgrade = null;
}
