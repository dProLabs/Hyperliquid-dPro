import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, saveConfig, getConfigDir } from './config.mjs';
import { encrypt, decrypt } from './utils/crypto.mjs';
import { accountNotFound, privateKeyMissing, inputError } from './errors.mjs';
import { KEYS_FILE } from './constants.mjs';

const keysPath = () => join(getConfigDir(), KEYS_FILE);
const KEYS_SCHEMA_VERSION = 3;
const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// In-memory password cache (session lifetime)
let masterPassword = null;

export function setMasterPassword(pwd) {
  masterPassword = pwd;
}

export function getMasterPassword() {
  return masterPassword;
}

function normalizeMasterAddressKey(masterAddress) {
  const s = String(masterAddress || '');
  if (!ETH_ADDRESS_RE.test(s)) {
    throw inputError(`Invalid master address: "${masterAddress}". Must be 0x-prefixed 40-hex-char Ethereum address.`);
  }
  return s.toLowerCase();
}

function normalizeKeysShapeV3(raw = {}) {
  const accounts = raw?.accounts && typeof raw.accounts === 'object' && !Array.isArray(raw.accounts)
    ? raw.accounts
    : {};
  const masterKeysByAddress = raw?.masterKeysByAddress && typeof raw.masterKeysByAddress === 'object' && !Array.isArray(raw.masterKeysByAddress)
    ? raw.masterKeysByAddress
    : {};

  const normalizedAccounts = {};
  for (const [alias, row] of Object.entries(accounts)) {
    if (!row || typeof row !== 'object') continue;
    const agentPrivateKey = typeof row.agentPrivateKey === 'string' && row.agentPrivateKey ? row.agentPrivateKey : null;
    if (agentPrivateKey) {
      normalizedAccounts[alias] = { agentPrivateKey };
    }
  }

  const normalizedMasterMap = {};
  for (const [address, key] of Object.entries(masterKeysByAddress)) {
    if (typeof key !== 'string' || !key) continue;
    const addrKey = normalizeMasterAddressKey(address);
    normalizedMasterMap[addrKey] = key;
  }

  return {
    schemaVersion: KEYS_SCHEMA_VERSION,
    accounts: normalizedAccounts,
    masterKeysByAddress: normalizedMasterMap,
  };
}

function migrateV1ToV3(parsed) {
  const accounts = {};
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const [alias, agentPrivateKey] of Object.entries(parsed)) {
      if (typeof agentPrivateKey === 'string' && agentPrivateKey) {
        accounts[alias] = { agentPrivateKey };
      }
    }
  }
  return {
    schemaVersion: KEYS_SCHEMA_VERSION,
    accounts,
    masterKeysByAddress: {},
  };
}

function migrateV2ToV3(parsed, configAccountsOverride = null) {
  const configAccounts = configAccountsOverride || loadConfig().accounts || [];
  const masterAddressByAlias = new Map(
    configAccounts
      .filter((a) => a && a.alias && a.masterAddress)
      .map((a) => [a.alias, String(a.masterAddress)]),
  );

  const out = {
    schemaVersion: KEYS_SCHEMA_VERSION,
    accounts: {},
    masterKeysByAddress: {},
  };

  const srcAccounts = parsed?.accounts && typeof parsed.accounts === 'object' ? parsed.accounts : {};
  for (const [alias, row] of Object.entries(srcAccounts)) {
    if (!row || typeof row !== 'object') continue;

    if (typeof row.agentPrivateKey === 'string' && row.agentPrivateKey) {
      out.accounts[alias] = { agentPrivateKey: row.agentPrivateKey };
    }

    if (typeof row.masterPrivateKey === 'string' && row.masterPrivateKey) {
      const masterAddress = masterAddressByAlias.get(alias);
      if (!masterAddress) {
        throw inputError(`Cannot migrate master key for alias "${alias}": masterAddress not found in config.json`);
      }
      const addressKey = normalizeMasterAddressKey(masterAddress);
      const existing = out.masterKeysByAddress[addressKey];
      if (existing && existing !== row.masterPrivateKey) {
        throw inputError(`Master key conflict during migration for ${masterAddress}: multiple aliases map to different master keys.`);
      }
      out.masterKeysByAddress[addressKey] = row.masterPrivateKey;
    }
  }

  return out;
}

export function __normalizeMasterAddressKeyForTest(masterAddress) {
  return normalizeMasterAddressKey(masterAddress);
}

export function __migrateV2ToV3ForTest(parsed, configAccounts = []) {
  return migrateV2ToV3(parsed, configAccounts);
}

// --- Keys file I/O ---

function loadKeysFile() {
  const p = keysPath();
  if (!existsSync(p)) {
    return { schemaVersion: KEYS_SCHEMA_VERSION, accounts: {}, masterKeysByAddress: {} };
  }
  const hex = readFileSync(p, 'utf8').trim();
  if (!hex) {
    return { schemaVersion: KEYS_SCHEMA_VERSION, accounts: {}, masterKeysByAddress: {} };
  }
  if (!masterPassword) throw privateKeyMissing('Master password not set. Provide password via runtimeContext.password.');
  const json = decrypt(hex, masterPassword);
  const parsed = JSON.parse(json);

  // v3 shape
  if (
    parsed &&
    typeof parsed === 'object' &&
    Number(parsed.schemaVersion) === KEYS_SCHEMA_VERSION
  ) {
    return normalizeKeysShapeV3(parsed);
  }

  // v2 shape: { schemaVersion: 2, accounts: { [alias]: { agentPrivateKey?, masterPrivateKey? } } }
  if (
    parsed &&
    typeof parsed === 'object' &&
    Number(parsed.schemaVersion) === 2 &&
    parsed.accounts &&
    typeof parsed.accounts === 'object' &&
    !Array.isArray(parsed.accounts)
  ) {
    return migrateV2ToV3(parsed);
  }

  // v1 shape: { [alias]: "<agentPrivateKey>" }
  return migrateV1ToV3(parsed);
}

function saveKeysFile(keys) {
  if (!masterPassword) throw privateKeyMissing('Master password not set.');
  const normalized = normalizeKeysShapeV3(keys);
  const json = JSON.stringify(normalized);
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
    hasAgentKey: false,
    hasMasterKey: false,
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
  keys.accounts[alias] = {
    ...(keys.accounts[alias] || {}),
    agentPrivateKey: agentPrivateKeyHex,
  };
  saveKeysFile(keys);

  const masterKeyPresent = hasMasterPrivateKeyByAddress(masterAddress);
  const account = {
    alias,
    masterAddress,
    agentAddress,
    mode: 'api',
    hasAgentKey: true,
    hasMasterKey: masterKeyPresent,
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

  // Remove agent key for this alias. Keep address-level master key mapping.
  if (removed.mode === 'api') {
    try {
      const keys = loadKeysFile();
      delete keys.accounts[alias];
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
  const key = keys.accounts?.[alias]?.agentPrivateKey;
  if (!key) throw privateKeyMissing(alias);
  return key;
}

export function hasMasterPrivateKeyByAddress(masterAddress) {
  try {
    const keys = loadKeysFile();
    const addressKey = normalizeMasterAddressKey(masterAddress);
    return !!keys.masterKeysByAddress?.[addressKey];
  } catch (err) {
    if (err?.code === 'PRIVATE_KEY_MISSING') return false;
    throw err;
  }
}

export function getMasterPrivateKeyByAddress(masterAddress) {
  const keys = loadKeysFile();
  const addressKey = normalizeMasterAddressKey(masterAddress);
  const key = keys.masterKeysByAddress?.[addressKey];
  if (!key) {
    throw privateKeyMissing(`${masterAddress} (missing master key, run: dpro-hl account add-master <masterAddress> <masterPrivKey> --password <password>)`);
  }
  return key;
}

export function addMasterPrivateKeyByAddress(masterAddress, masterPrivateKeyHex) {
  const keys = loadKeysFile();
  const addressKey = normalizeMasterAddressKey(masterAddress);
  if (keys.masterKeysByAddress?.[addressKey]) {
    throw inputError(`Master private key already exists for ${masterAddress}. Use "dpro-hl account update-master <masterAddress> <masterPrivKey> --password <password>".`);
  }
  keys.masterKeysByAddress[addressKey] = masterPrivateKeyHex;
  saveKeysFile(keys);
}

export function updateMasterPrivateKeyByAddress(masterAddress, masterPrivateKeyHex) {
  const keys = loadKeysFile();
  const addressKey = normalizeMasterAddressKey(masterAddress);
  if (!keys.masterKeysByAddress?.[addressKey]) {
    throw inputError(`Master private key not found for ${masterAddress}. Use "dpro-hl account add-master <masterAddress> <masterPrivKey> --password <password>".`);
  }
  keys.masterKeysByAddress[addressKey] = masterPrivateKeyHex;
  saveKeysFile(keys);
}

export function removeMasterPrivateKeyByAddress(masterAddress) {
  const keys = loadKeysFile();
  const addressKey = normalizeMasterAddressKey(masterAddress);
  if (!keys.masterKeysByAddress?.[addressKey]) {
    throw inputError(`Master private key not found for ${masterAddress}.`);
  }
  delete keys.masterKeysByAddress[addressKey];
  saveKeysFile(keys);
}
