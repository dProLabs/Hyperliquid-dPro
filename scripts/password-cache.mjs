import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getConfigDir } from './config.mjs';
import { DEFAULT_PASSWORD_CACHE_TTL_SEC, PASSWORD_CACHE_FILE } from './constants.mjs';

function isCacheEnabled(env = process.env) {
  const raw = String(env.DPRO_HL_PASSWORD_CACHE ?? '1').trim().toLowerCase();
  return !(raw === '0' || raw === 'false' || raw === 'off' || raw === 'no');
}

function parseTtlSec(env = process.env) {
  const raw = env.DPRO_HL_PASSWORD_CACHE_TTL_SEC;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PASSWORD_CACHE_TTL_SEC;
  return Math.floor(parsed);
}

function getCachePath(env = process.env) {
  const explicit = env.DPRO_HL_PASSWORD_CACHE_FILE;
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  return join(getConfigDir(), PASSWORD_CACHE_FILE);
}

export function loadCachedPassword(now = Date.now(), env = process.env) {
  if (!isCacheEnabled(env)) return null;
  const filePath = getCachePath(env);
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, 'utf8');
    if (!raw?.trim()) return null;
    const payload = JSON.parse(raw);
    const password = payload?.password;
    const expiresAt = Number(payload?.expiresAt);
    if (typeof password !== 'string' || !Number.isFinite(expiresAt)) {
      unlinkSync(filePath);
      return null;
    }
    if (now >= expiresAt) {
      unlinkSync(filePath);
      return null;
    }
    return password;
  } catch {
    return null;
  }
}

export function saveCachedPassword(password, now = Date.now(), env = process.env) {
  if (!isCacheEnabled(env)) return;
  if (typeof password !== 'string' || !password) return;
  const filePath = getCachePath(env);
  const ttlSec = parseTtlSec(env);
  const payload = {
    password,
    savedAt: now,
    expiresAt: now + ttlSec * 1000,
  };
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 });
    chmodSync(filePath, 0o600);
  } catch {
    // Cache write should never block command execution.
  }
}

export function clearCachedPassword(env = process.env) {
  const filePath = getCachePath(env);
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {
    // best-effort cleanup
  }
}

export const __passwordCacheTestUtils = {
  isCacheEnabled,
  parseTtlSec,
  getCachePath,
};
