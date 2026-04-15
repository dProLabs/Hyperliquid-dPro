import { readFile } from 'node:fs/promises';
import { DEFAULT_TIMEOUT_MS } from '../constants.mjs';
import { apiRejected, inputError, networkError } from '../errors.mjs';

const OPENAPI_URL = new URL('../../docs/openapi.json', import.meta.url);
const ONCHAIN_BASE_URL = 'https://api.d.pro/';

const EXCLUDED_PATHS = new Set([
  '/api/v1/asset-data/news',
  '/api/v1/asset-data/mappings',
  '/api/v1/asset-data/mappings/refresh',
  '/api/v1/news',
  '/api/v1/mappings',
  '/api/v1/mappings/refresh',
  '/api/v1/claimable_balance',
]);

const EXCLUDED_PREFIXES = [
  '/api/v1/referral/',
];

const FALLBACK_ALLOWLIST = new Set([
  '/api/v1',
  '/api/v1/health',
  '/api/v1/hl/prices/mids',
  '/api/v1/hl/meta/address-tags',
  '/api/v1/hl/meta/perps-universe',
  '/api/v1/hl/trending',
  '/api/v1/hl/spot/holders',
  '/api/v1/hl/spot/holders/counts',
  '/api/v1/hl/perp/holders',
  '/api/v1/hl/orders/book',
  '/api/v1/hl/orders/untriggered',
  '/api/v1/hl/orders/chart',
  '/api/v1/hl/liqmap',
  '/api/v1/hl/liqmap/timeline',
  '/api/v1/hl/perp/liquidation-map',
  '/api/v1/leaderboard',
]);

let openapiCache = null;
let allowlistCache = null;

async function loadOpenapi() {
  if (!openapiCache) {
    openapiCache = readFile(OPENAPI_URL, 'utf8').then((raw) => JSON.parse(raw));
  }
  return openapiCache;
}

function hasImageResponse(op) {
  const responses = op?.responses || {};
  for (const response of Object.values(responses)) {
    const content = response?.content || {};
    for (const mediaType of Object.keys(content)) {
      if (String(mediaType).toLowerCase().startsWith('image/')) return true;
    }
  }
  return false;
}

function isExcludedPath(path) {
  if (EXCLUDED_PATHS.has(path)) return true;
  return EXCLUDED_PREFIXES.some(prefix => path.startsWith(prefix));
}

async function buildAllowlist() {
  let spec;
  try {
    spec = await loadOpenapi();
  } catch {
    return new Set(FALLBACK_ALLOWLIST);
  }
  const paths = spec?.paths || {};
  const allowlist = new Set();

  for (const [path, methods] of Object.entries(paths)) {
    const getOp = methods?.get;
    if (!getOp) continue;
    if (isExcludedPath(path)) continue;
    if (hasImageResponse(getOp)) continue;
    allowlist.add(path);
  }

  return allowlist;
}

export async function getAllowedOnchainGetPaths() {
  if (!allowlistCache) {
    allowlistCache = buildAllowlist();
  }
  return allowlistCache;
}

function resolveBaseUrl() {
  return ONCHAIN_BASE_URL;
}

function buildUrl(baseUrl, path, query = {}) {
  const normalizedBase = String(baseUrl).replace(/\/+$/, '');
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value == null || value === '') continue;
    qs.set(key, String(value));
  }
  const suffix = qs.size ? `?${qs.toString()}` : '';
  return `${normalizedBase}${path}${suffix}`;
}

export async function getOnchain(path, query = {}, ctx = {}) {
  const allowlist = await getAllowedOnchainGetPaths();
  if (!allowlist.has(path)) {
    throw inputError(`Onchain endpoint not allowed: ${path}`);
  }

  const baseUrl = resolveBaseUrl();
  const url = buildUrl(baseUrl, path, query);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw apiRejected(`Onchain API error ${res.status} for ${path}: ${body}`, { status: res.status, path, body });
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json();
    }

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw networkError(`Onchain request timed out after ${DEFAULT_TIMEOUT_MS}ms`, { path });
    }
    if (err?.code === 'API_REJECTED') throw err;
    throw networkError(`Onchain network error: ${err.message}`, { path, cause: err.message });
  } finally {
    clearTimeout(timeout);
  }
}
