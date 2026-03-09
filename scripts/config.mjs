import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { CONFIG_DIR, CONFIG_FILE, UPGRADE_STATE_FILE } from './constants.mjs';

const configDir = join(homedir(), CONFIG_DIR);
const configPath = join(configDir, CONFIG_FILE);
const upgradeStatePath = join(configDir, UPGRADE_STATE_FILE);

function ensureDir() {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
}

const DEFAULTS = {
  defaultNetwork: 'mainnet',
  defaultAccountAlias: null,
  accounts: [],
};

let cachedConfig = null;

const UPGRADE_STATE_DEFAULTS = {
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

function atomicWriteJson(filePath, data) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  renameSync(tmpPath, filePath);
}

export function loadConfig() {
  if (cachedConfig) return cachedConfig;
  ensureDir();
  if (existsSync(configPath)) {
    try {
      cachedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      return cachedConfig;
    } catch {
      // corrupted — use defaults
    }
  }
  cachedConfig = { ...DEFAULTS };
  return cachedConfig;
}

export function saveConfig(config) {
  ensureDir();
  cachedConfig = config;
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

export function loadUpgradeState() {
  ensureDir();
  if (existsSync(upgradeStatePath)) {
    try {
      const parsed = JSON.parse(readFileSync(upgradeStatePath, 'utf8'));
      return { ...UPGRADE_STATE_DEFAULTS, ...parsed };
    } catch {
      // corrupted — use defaults
    }
  }
  return { ...UPGRADE_STATE_DEFAULTS };
}

export function saveUpgradeState(state) {
  ensureDir();
  atomicWriteJson(upgradeStatePath, { ...UPGRADE_STATE_DEFAULTS, ...state });
}

export function getConfigDir() {
  return configDir;
}

export function resetConfigCache() {
  cachedConfig = null;
}
