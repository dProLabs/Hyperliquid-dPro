import { ASSET_API_URL, DEFAULT_TIMEOUT_MS } from '../constants.mjs';
import { apiRejected, networkError } from '../errors.mjs';

function resolveBaseUrl(ctx = {}, env = process.env) {
  return String(ctx.assetApiBaseUrl || env.DPRO_HL_ASSET_BASE_URL || ASSET_API_URL).replace(/\/+$/, '');
}

function buildUrl(baseUrl, path, query = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value == null || value === '') continue;
    qs.set(key, String(value));
  }
  const suffix = qs.size ? `?${qs.toString()}` : '';
  return `${baseUrl}${path}${suffix}`;
}

function cacheHeader(res) {
  return res.headers.get('x-cache') || res.headers.get('X-Cache') || undefined;
}

function unwrapEnvelope(payload, path, meta) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { data: payload, meta };
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'code') && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    if (payload.code !== 0) {
      throw apiRejected(`Asset API rejected ${path}: ${payload.message || payload.code}`, { path, payload });
    }
    return {
      data: payload.data,
      meta: {
        ...meta,
        code: payload.code,
        message: payload.message,
        timestamp: payload.timestamp,
      },
    };
  }

  return { data: payload, meta };
}

export async function getAssetData(path, query = {}, ctx = {}) {
  const baseUrl = resolveBaseUrl(ctx);
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
      throw apiRejected(`Asset API error ${res.status} for ${path}: ${body}`, { status: res.status, path, body });
    }

    const meta = { cache: cacheHeader(res) };
    const contentType = res.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await res.json()
      : JSON.parse(await res.text());
    return unwrapEnvelope(payload, path, meta);
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw networkError(`Asset request timed out after ${DEFAULT_TIMEOUT_MS}ms`, { path });
    }
    if (err?.code === 'API_REJECTED') throw err;
    throw networkError(`Asset network error: ${err.message}`, { path, cause: err.message });
  } finally {
    clearTimeout(timeout);
  }
}

export const __assetClientForTest = { buildUrl, resolveBaseUrl };
