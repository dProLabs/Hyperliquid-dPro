import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, saveConfig, getConfigDir } from './config.mjs';
import { encrypt, decrypt } from './utils/crypto.mjs';
import { accountNotFound, privateKeyMissing, inputError } from './errors.mjs';
import { KEYS_FILE } from './constants.mjs';

const keysPath = () => join(getConfigDir(), KEYS_FILE);

// In-memory password cache (session lifetime)
let masterPassword = null;

export function setMasterPassword(pwd) {
  masterPassword = pwd;
}

export function getMasterPassword() {
  return masterPassword;
}

// --- Keys file I/O ---

function loadKeysFile() {
  const p = keysPath();
  if (!existsSync(p)) return {};
  const hex = readFileSync(p, 'utf8').trim();
  if (!hex) return {};
  if (!masterPassword) throw privateKeyMissing('Master password not set. Provide password via runtimeContext.password.');
  const json = decrypt(hex, masterPassword);
  return JSON.parse(json);
}

function saveKeysFile(keys) {
  if (!masterPassword) throw privateKeyMissing('Master password not set.');
  const json = JSON.stringify(keys);
  const hex = encrypt(json, masterPassword);
  writeFileSync(keysPath(), hex, 'utf8');
}

// --- Account CRUD ---

export function listAccounts() {
  const config = loadConfig();
  return config.accounts || [];
}

export function findAccount(aliasOrAddress) {
  const accounts = listAccounts();
  if (!aliasOrAddress) {
    // Return default
    const config = loadConfig();
    const def = config.defaultAccountAlias;
    if (def) {
      const found = accounts.find(a => a.alias === def);
      if (found) return found;
    }
    if (accounts.length === 1) return accounts[0];
    return null;
  }

  const lower = aliasOrAddress.toLowerCase();
  return accounts.find(a =>
    a.alias.toLowerCase() === lower ||
    a.masterAddress.toLowerCase() === lower
  ) || null;
}

export function addReadonlyAccount(masterAddress, alias) {
  const config = loadConfig();
  if (!config.accounts) config.accounts = [];

  if (config.accounts.find(a => a.alias === alias)) {
    throw inputError(`Account alias "${alias}" already exists.`);
  }

  const account = {
    alias,
    masterAddress,
    mode: 'readonly',
    isDefault: config.accounts.length === 0,
  };

  config.accounts.push(account);
  if (account.isDefault) config.defaultAccountAlias = alias;
  saveConfig(config);
  return account;
}

export function addApiAccount(masterAddress, agentAddress, agentPrivateKeyHex, alias) {
  const config = loadConfig();
  if (!config.accounts) config.accounts = [];

  if (config.accounts.find(a => a.alias === alias)) {
    throw inputError(`Account alias "${alias}" already exists.`);
  }

  // Store private key in encrypted file
  const keys = loadKeysFile();
  keys[alias] = agentPrivateKeyHex;
  saveKeysFile(keys);

  const account = {
    alias,
    masterAddress,
    agentAddress,
    mode: 'api',
    isDefault: config.accounts.length === 0,
  };

  config.accounts.push(account);
  if (account.isDefault) config.defaultAccountAlias = alias;
  saveConfig(config);
  return account;
}

export function removeAccount(alias) {
  const config = loadConfig();
  const idx = (config.accounts || []).findIndex(a => a.alias === alias);
  if (idx === -1) throw accountNotFound(alias);

  const removed = config.accounts.splice(idx, 1)[0];

  // Remove key if api account
  if (removed.mode === 'api') {
    try {
      const keys = loadKeysFile();
      delete keys[alias];
      saveKeysFile(keys);
    } catch {
      // ignore if keys file doesn't exist
    }
  }

  if (config.defaultAccountAlias === alias) {
    config.defaultAccountAlias = config.accounts[0]?.alias || null;
  }
  saveConfig(config);
  return removed;
}

export function setDefaultAccount(alias) {
  const config = loadConfig();
  const account = (config.accounts || []).find(a => a.alias === alias);
  if (!account) throw accountNotFound(alias);

  for (const a of config.accounts) a.isDefault = a.alias === alias;
  config.defaultAccountAlias = alias;
  saveConfig(config);
  return account;
}

export function getAgentPrivateKey(alias) {
  const keys = loadKeysFile();
  const key = keys[alias];
  if (!key) throw privateKeyMissing(alias);
  return key;
}
