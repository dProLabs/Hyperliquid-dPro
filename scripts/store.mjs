import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, saveConfig, getConfigDir } from './config.mjs';
import { encrypt, decrypt } from './utils/crypto.mjs';
import { accountNotFound, privateKeyMissing, inputError } from './errors.mjs';
import { API_KEYS_FILE, KEYS_FILE, MASTER_KEYS_FILE } from './constants.mjs';

const legacyKeysPath = () => join(getConfigDir(), KEYS_FILE);
const apiKeysPath = () => join(getConfigDir(), API_KEYS_FILE);
const masterKeysPath = () => join(getConfigDir(), MASTER_KEYS_FILE);

const LEGACY_KEYS_SCHEMA_VERSION = 3;
const API_KEYS_SCHEMA_VERSION = 1;
const MASTER_KEYS_SCHEMA_VERSION = 1;
const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// In-memory password cache (session lifetime)
let apiWalletPassword = null;
let masterWalletPassword = null;

export function setApiWalletPassword(pwd) {
  apiWalletPassword = pwd;
}

export function getApiWalletPassword() {
  return apiWalletPassword;
}

export function setMasterPassword(pwd) {
  masterWalletPassword = pwd;
}

export function getMasterPassword() {
  return masterWalletPassword;
}

function normalizeMasterAddressKey(masterAddress) {
  const s = String(masterAddress || '');
  if (!ETH_ADDRESS_RE.test(s)) {
    throw inputError(`Invalid master address: "${masterAddress}". Must be 0x-prefixed 40-hex-char Ethereum address.`);
  }
  return s.toLowerCase();
}

function normalizeApiKeysShape(raw = {}) {
  const accounts = raw?.accounts && typeof raw.accounts === 'object' && !Array.isArray(raw.accounts)
    ? raw.accounts
    : {};

  const normalizedAccounts = {};
  for (const [alias, row] of Object.entries(accounts)) {
    if (!row || typeof row !== 'object') continue;
    const agentPrivateKey = typeof row.agentPrivateKey === 'string' && row.agentPrivateKey ? row.agentPrivateKey : null;
    if (agentPrivateKey) normalizedAccounts[alias] = { agentPrivateKey };
  }

  return {
    schemaVersion: API_KEYS_SCHEMA_VERSION,
    accounts: normalizedAccounts,
  };
}

function normalizeMasterKeysShape(raw = {}) {
  const masterKeysByAddress = raw?.masterKeysByAddress && typeof raw.masterKeysByAddress === 'object' && !Array.isArray(raw.masterKeysByAddress)
    ? raw.masterKeysByAddress
    : {};

  const normalizedMasterMap = {};
  for (const [address, key] of Object.entries(masterKeysByAddress)) {
    if (typeof key !== 'string' || !key) continue;
    const addrKey = normalizeMasterAddressKey(address);
    normalizedMasterMap[addrKey] = key;
  }

  return {
    schemaVersion: MASTER_KEYS_SCHEMA_VERSION,
    masterKeysByAddress: normalizedMasterMap,
  };
}

function normalizeLegacyKeysShapeV3(raw = {}) {
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
    schemaVersion: LEGACY_KEYS_SCHEMA_VERSION,
    accounts: normalizedAccounts,
    masterKeysByAddress: normalizedMasterMap,
  };
}

function migrateLegacyV1ToV3(parsed) {
  const accounts = {};
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const [alias, agentPrivateKey] of Object.entries(parsed)) {
      if (typeof agentPrivateKey === 'string' && agentPrivateKey) {
        accounts[alias] = { agentPrivateKey };
      }
    }
  }
  return {
    schemaVersion: LEGACY_KEYS_SCHEMA_VERSION,
    accounts,
    masterKeysByAddress: {},
  };
}

function migrateLegacyV2ToV3(parsed, configAccountsOverride = null) {
  const configAccounts = configAccountsOverride || loadConfig().accounts || [];
  const masterAddressByAlias = new Map(
    configAccounts
      .filter((a) => a && a.alias && a.masterAddress)
      .map((a) => [a.alias, String(a.masterAddress)]),
  );

  const out = {
    schemaVersion: LEGACY_KEYS_SCHEMA_VERSION,
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
  return migrateLegacyV2ToV3(parsed, configAccounts);
}

function parseLegacyKeysJson(json) {
  const parsed = JSON.parse(json);
  if (
    parsed &&
    typeof parsed === 'object' &&
    Number(parsed.schemaVersion) === LEGACY_KEYS_SCHEMA_VERSION
  ) {
    return normalizeLegacyKeysShapeV3(parsed);
  }
  if (
    parsed &&
    typeof parsed === 'object' &&
    Number(parsed.schemaVersion) === 2 &&
    parsed.accounts &&
    typeof parsed.accounts === 'object' &&
    !Array.isArray(parsed.accounts)
  ) {
    return migrateLegacyV2ToV3(parsed);
  }
  return migrateLegacyV1ToV3(parsed);
}

function getAnyWalletPassword() {
  return masterWalletPassword || apiWalletPassword || null;
}

function migrateLegacyKeysIfNeeded() {
  if (existsSync(apiKeysPath()) && existsSync(masterKeysPath())) return;
  if (!existsSync(legacyKeysPath())) return;

  const pwd = getAnyWalletPassword();
  if (!pwd) {
    throw privateKeyMissing(
      'Password not set for legacy keys migration. Provide --api-password or --master-password.',
    );
  }

  const hex = readFileSync(legacyKeysPath(), 'utf8').trim();
  if (!hex) return;

  const legacyJson = decrypt(hex, pwd);
  const legacy = parseLegacyKeysJson(legacyJson);
  const apiKeys = normalizeApiKeysShape({ accounts: legacy.accounts });
  const masterKeys = normalizeMasterKeysShape({ masterKeysByAddress: legacy.masterKeysByAddress });

  const apiPwd = apiWalletPassword || pwd;
  const masterPwd = masterWalletPassword || pwd;
  writeFileSync(apiKeysPath(), encrypt(JSON.stringify(apiKeys), apiPwd), 'utf8');
  writeFileSync(masterKeysPath(), encrypt(JSON.stringify(masterKeys), masterPwd), 'utf8');

  const backupPath = `${legacyKeysPath()}.legacy-backup`;
  if (!existsSync(backupPath)) {
    renameSync(legacyKeysPath(), backupPath);
  }
}

function loadApiKeysFile() {
  migrateLegacyKeysIfNeeded();
  const p = apiKeysPath();
  if (!existsSync(p)) return { schemaVersion: API_KEYS_SCHEMA_VERSION, accounts: {} };
  const hex = readFileSync(p, 'utf8').trim();
  if (!hex) return { schemaVersion: API_KEYS_SCHEMA_VERSION, accounts: {} };
  if (!apiWalletPassword) {
    throw privateKeyMissing('API wallet password not set. Provide --api-password or runtimeContext.apiPassword.');
  }
  const json = decrypt(hex, apiWalletPassword);
  return normalizeApiKeysShape(JSON.parse(json));
}

function saveApiKeysFile(keys) {
  if (!apiWalletPassword) {
    throw privateKeyMissing('API wallet password not set. Provide --api-password or runtimeContext.apiPassword.');
  }
  const normalized = normalizeApiKeysShape(keys);
  const hex = encrypt(JSON.stringify(normalized), apiWalletPassword);
  writeFileSync(apiKeysPath(), hex, 'utf8');
}

function loadMasterKeysFile() {
  migrateLegacyKeysIfNeeded();
  const p = masterKeysPath();
  if (!existsSync(p)) return { schemaVersion: MASTER_KEYS_SCHEMA_VERSION, masterKeysByAddress: {} };
  const hex = readFileSync(p, 'utf8').trim();
  if (!hex) return { schemaVersion: MASTER_KEYS_SCHEMA_VERSION, masterKeysByAddress: {} };
  if (!masterWalletPassword) {
    throw privateKeyMissing('Master wallet password not set. Provide --master-password or runtimeContext.masterPassword.');
  }
  const json = decrypt(hex, masterWalletPassword);
  return normalizeMasterKeysShape(JSON.parse(json));
}

function saveMasterKeysFile(keys) {
  if (!masterWalletPassword) {
    throw privateKeyMissing('Master wallet password not set. Provide --master-password or runtimeContext.masterPassword.');
  }
  const normalized = normalizeMasterKeysShape(keys);
  const hex = encrypt(JSON.stringify(normalized), masterWalletPassword);
  writeFileSync(masterKeysPath(), hex, 'utf8');
}

// --- Account CRUD ---

export function listAccounts() {
  const config = loadConfig();
  return config.accounts || [];
}

export function findAccount(aliasOrAddress) {
  const accounts = listAccounts();
  if (!aliasOrAddress) {
    const config = loadConfig();
    const def = config.defaultAccountAlias;
    if (def) {
      const found = accounts.find((a) => a.alias === def);
      if (found) return found;
    }
    if (accounts.length === 1) return accounts[0];
    return null;
  }

  const lower = aliasOrAddress.toLowerCase();
  const aliasMatch = accounts.find((a) => a.alias.toLowerCase() === lower);
  if (aliasMatch) return aliasMatch;

  const addressMatches = accounts.filter((a) => a.masterAddress.toLowerCase() === lower);
  if (!addressMatches.length) return null;
  if (addressMatches.length > 1) {
    const aliases = addressMatches.map((a) => a.alias).join(', ');
    throw inputError(`Multiple accounts share master address ${aliasOrAddress}. Use --account <alias>. Matches: ${aliases}`);
  }
  return addressMatches[0];
}

export function addReadonlyAccount(masterAddress, alias) {
  const config = loadConfig();
  if (!config.accounts) config.accounts = [];

  if (config.accounts.find((a) => a.alias === alias)) {
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

  if (config.accounts.find((a) => a.alias === alias)) {
    throw inputError(`Account alias "${alias}" already exists.`);
  }

  const keys = loadApiKeysFile();
  keys.accounts[alias] = {
    ...(keys.accounts[alias] || {}),
    agentPrivateKey: agentPrivateKeyHex,
  };
  saveApiKeysFile(keys);

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
  const idx = (config.accounts || []).findIndex((a) => a.alias === alias);
  if (idx === -1) throw accountNotFound(alias);

  const removed = config.accounts.splice(idx, 1)[0];
  if (removed.mode === 'api') {
    try {
      const keys = loadApiKeysFile();
      delete keys.accounts[alias];
      saveApiKeysFile(keys);
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
  const account = (config.accounts || []).find((a) => a.alias === alias);
  if (!account) throw accountNotFound(alias);

  for (const a of config.accounts) a.isDefault = a.alias === alias;
  config.defaultAccountAlias = alias;
  saveConfig(config);
  return account;
}

export function getAgentPrivateKey(alias) {
  const keys = loadApiKeysFile();
  const key = keys.accounts?.[alias]?.agentPrivateKey;
  if (!key) throw privateKeyMissing(alias);
  return key;
}

export function hasMasterPrivateKeyByAddress(masterAddress) {
  try {
    const keys = loadMasterKeysFile();
    const addressKey = normalizeMasterAddressKey(masterAddress);
    return !!keys.masterKeysByAddress?.[addressKey];
  } catch (err) {
    if (err?.code === 'PRIVATE_KEY_MISSING' || err?.code === 'ENCRYPTION_ERROR') return false;
    throw err;
  }
}

export function getMasterPrivateKeyByAddress(masterAddress) {
  const keys = loadMasterKeysFile();
  const addressKey = normalizeMasterAddressKey(masterAddress);
  const key = keys.masterKeysByAddress?.[addressKey];
  if (!key) {
    throw privateKeyMissing(`${masterAddress} (missing master key, run: dpro-hl account add-master <masterAddress> <masterPrivKey> --master-password <password>)`);
  }
  return key;
}

export function addMasterPrivateKeyByAddress(masterAddress, masterPrivateKeyHex) {
  const keys = loadMasterKeysFile();
  const addressKey = normalizeMasterAddressKey(masterAddress);
  if (keys.masterKeysByAddress?.[addressKey]) {
    throw inputError(`Master private key already exists for ${masterAddress}. Use "dpro-hl account update-master <masterAddress> <masterPrivKey> --master-password <password>".`);
  }
  keys.masterKeysByAddress[addressKey] = masterPrivateKeyHex;
  saveMasterKeysFile(keys);
}

export function updateMasterPrivateKeyByAddress(masterAddress, masterPrivateKeyHex) {
  const keys = loadMasterKeysFile();
  const addressKey = normalizeMasterAddressKey(masterAddress);
  if (!keys.masterKeysByAddress?.[addressKey]) {
    throw inputError(`Master private key not found for ${masterAddress}. Use "dpro-hl account add-master <masterAddress> <masterPrivKey> --master-password <password>".`);
  }
  keys.masterKeysByAddress[addressKey] = masterPrivateKeyHex;
  saveMasterKeysFile(keys);
}

export function removeMasterPrivateKeyByAddress(masterAddress) {
  const keys = loadMasterKeysFile();
  const addressKey = normalizeMasterAddressKey(masterAddress);
  if (!keys.masterKeysByAddress?.[addressKey]) {
    throw inputError(`Master private key not found for ${masterAddress}.`);
  }
  delete keys.masterKeysByAddress[addressKey];
  saveMasterKeysFile(keys);
}
