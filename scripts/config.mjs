import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { CONFIG_DIR, CONFIG_FILE } from './constants.mjs';

const configDir = join(homedir(), CONFIG_DIR);
const configPath = join(configDir, CONFIG_FILE);

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

export function getConfigDir() {
  return configDir;
}

export function resetConfigCache() {
  cachedConfig = null;
}
