import { MAINNET_URL, DEFAULT_TIMEOUT_MS } from '../constants.mjs';
import { networkError, apiRejected } from '../errors.mjs';

let baseUrl = MAINNET_URL;

export function setBaseUrl(url) {
  baseUrl = url;
}

export function getBaseUrl() {
  return baseUrl;
}

/**
 * POST JSON to Hyperliquid API with timeout and optional retry.
 */
export async function post(path, body, opts = {}) {
  const {
    timeout = DEFAULT_TIMEOUT_MS,
    retries = 0,
    retryDelay = 1000,
  } = opts;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        if (res.status === 429) {
          throw apiRejected(`Rate limited (429)`, { status: 429, body: text });
        }
        throw apiRejected(`API error ${res.status}: ${text}`, { status: res.status, body: text });
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      lastError = err;

      if (err.name === 'AbortError') {
        lastError = networkError(`Request timed out after ${timeout}ms`);
      } else if (err.code === 'API_REJECTED' || err.code === 'API_RATE_LIMIT') {
        throw err; // Don't retry API rejections
      } else if (err instanceof TypeError || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        lastError = networkError(`Network error: ${err.message}`, { cause: err.message });
      }

      if (attempt < retries) {
        await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * POST to /info endpoint (read-only, safe to retry)
 */
export async function postInfo(body) {
  return post('/info', body, { retries: 2 });
}

/**
 * POST to /exchange endpoint (write, no retry by default)
 */
export async function postExchange(body) {
  return post('/exchange', body, { retries: 0 });
}
