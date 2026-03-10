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

function loadPayload(filePath) {
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, 'utf8');
  if (!raw?.trim()) return null;
  return JSON.parse(raw);
}

function isExpired(now, expiresAt) {
  return !Number.isFinite(expiresAt) || now >= expiresAt;
}

function savePayload(filePath, payload) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 });
  chmodSync(filePath, 0o600);
}

export function loadCachedApiPassword(now = Date.now(), env = process.env) {
  if (!isCacheEnabled(env)) return null;
  const filePath = getCachePath(env);
  try {
    const payload = loadPayload(filePath);
    if (!payload) return null;

    // Backward compatibility: old single-password cache.
    if (typeof payload.password === 'string') {
      const expiresAt = Number(payload?.expiresAt);
      if (isExpired(now, expiresAt)) {
        unlinkSync(filePath);
        return null;
      }
      return payload.password;
    }

    const apiPassword = payload?.apiPassword;
    const apiExpiresAt = Number(payload?.apiExpiresAt);
    if (typeof apiPassword !== 'string' || isExpired(now, apiExpiresAt)) return null;
    return apiPassword;
  } catch {
    return null;
  }
}

export function loadCachedMasterPassword(now = Date.now(), env = process.env) {
  if (!isCacheEnabled(env)) return null;
  const filePath = getCachePath(env);
  try {
    const payload = loadPayload(filePath);
    if (!payload) return null;

    // Backward compatibility: old single-password cache.
    if (typeof payload.password === 'string') {
      const expiresAt = Number(payload?.expiresAt);
      if (isExpired(now, expiresAt)) {
        unlinkSync(filePath);
        return null;
      }
      return payload.password;
    }

    const masterPassword = payload?.masterPassword;
    const masterExpiresAt = Number(payload?.masterExpiresAt);
    if (typeof masterPassword !== 'string' || isExpired(now, masterExpiresAt)) return null;
    return masterPassword;
  } catch {
    return null;
  }
}

export function saveCachedApiPassword(password, now = Date.now(), env = process.env) {
  if (!isCacheEnabled(env)) return;
  if (typeof password !== 'string' || !password) return;
  const filePath = getCachePath(env);
  const ttlSec = parseTtlSec(env);
  const expiresAt = now + ttlSec * 1000;
  try {
    const payload = loadPayload(filePath) || {};
    payload.apiPassword = password;
    payload.apiSavedAt = now;
    payload.apiExpiresAt = expiresAt;
    savePayload(filePath, payload);
  } catch {
    // Cache write should never block command execution.
  }
}

export function saveCachedMasterPassword(password, now = Date.now(), env = process.env) {
  if (!isCacheEnabled(env)) return;
  if (typeof password !== 'string' || !password) return;
  const filePath = getCachePath(env);
  const ttlSec = parseTtlSec(env);
  const expiresAt = now + ttlSec * 1000;
  try {
    const payload = loadPayload(filePath) || {};
    payload.masterPassword = password;
    payload.masterSavedAt = now;
    payload.masterExpiresAt = expiresAt;
    savePayload(filePath, payload);
  } catch {
    // Cache write should never block command execution.
  }
}

export function clearCachedPasswords(env = process.env) {
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
