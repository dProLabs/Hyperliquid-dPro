import { DEFAULT_ASSET_LIST_LIMIT } from '../constants.mjs';
import { getAssetData } from '../clients/asset-client.mjs';
import { inputError } from '../errors.mjs';
import { assertPositiveInteger } from '../utils/validate.mjs';

const ASSET_TYPES = new Set(['CRYPTO', 'STOCK', 'ETF', 'FOREX', 'COMMODITY']);
const ASSET_SORTS = new Set(['marketCap', 'volume24h', 'change24h', 'change7d', 'price', 'priceUpdatedAt', 'rank', 'createdAt', 'updatedAt', 'name', 'symbol']);
const RWA_SORTS = new Set(['rank', 'name', 'symbol', 'rwaPrice', 'avgTokenPrice', 'changePct', 'marketCap', 'volume', 'tokenMcap', 'tokenVol', 'updatedAt']);
const KLINE_INTERVALS = new Set(['M1', 'M5', 'M15', 'H1', 'H4', 'D1', 'W1', 'MN1']);
const VENUES = new Set(['all', 'cex', 'dex']);
const PAIR_MARKET_TYPES = new Set(['all', 'spot', 'perp', 'futures']);

function compact(query = {}) {
  return Object.fromEntries(Object.entries(query).filter(([, v]) => v != null && v !== ''));
}

function asOptionalString(value) {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s || undefined;
}

function parsePage(value) {
  return value == null ? 1 : assertPositiveInteger(value, 'page');
}

function parseLimit(value, label, defaultValue, max) {
  const limit = value == null ? defaultValue : assertPositiveInteger(value, label);
  if (max != null && limit > max) throw inputError(`${label} must be <= ${max}, got: "${value}"`);
  return limit;
}

function parseOrder(value) {
  if (value == null) return undefined;
  const order = String(value).trim().toLowerCase();
  if (order !== 'asc' && order !== 'desc') {
    throw inputError(`order must be "asc" or "desc", got: "${value}"`);
  }
  return order;
}

function parseAssetType(value) {
  const type = String(value || '').trim().toUpperCase();
  if (!ASSET_TYPES.has(type)) {
    throw inputError(`Usage: dpro-hl asset ls --type CRYPTO|STOCK|ETF|FOREX|COMMODITY [--limit N]`);
  }
  return type;
}

function parseSort(value, allowed, fallback, label = 'sort') {
  if (value == null || value === '') return fallback;
  const sort = String(value).trim();
  if (!allowed.has(sort)) {
    throw inputError(`${label} must be one of: ${[...allowed].join(', ')}. got: "${value}"`);
  }
  return sort;
}

function parseInterval(value) {
  const interval = String(value || 'H1').trim().toUpperCase();
  if (!KLINE_INTERVALS.has(interval)) {
    throw inputError(`interval must be one of: ${[...KLINE_INTERVALS].join(', ')}. got: "${value}"`);
  }
  return interval;
}

function parseEnum(value, allowed, fallback, label) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (!allowed.has(normalized)) {
    throw inputError(`${label} must be one of: ${[...allowed].join(', ')}. got: "${value}"`);
  }
  return normalized;
}

function wrap(type, payload, meta, path, query = {}) {
  return {
    ok: true,
    type,
    data: { path, query, payload, meta },
  };
}

async function search(parsed, ctx) {
  const q = asOptionalString(parsed.args?.query || parsed.target);
  if (!q) throw inputError('Usage: dpro-hl asset search <query>');
  const path = '/api/search';
  const query = { q };
  const { data: payload, meta } = await getAssetData(path, query, ctx);
  return wrap('asset-search', payload, meta, path, query);
}

async function ls(parsed, ctx) {
  const query = compact({
    type: parseAssetType(parsed.flags?.type),
    sort: parseSort(parsed.flags?.sort, ASSET_SORTS, 'marketCap'),
    order: parseOrder(parsed.flags?.order),
    market: asOptionalString(parsed.flags?.market)?.toUpperCase(),
    page: parsePage(parsed.flags?.page),
    limit: parseLimit(parsed.flags?.limit, 'limit', DEFAULT_ASSET_LIST_LIMIT, 100),
  });
  const path = '/api/assets';
  const { data: payload, meta } = await getAssetData(path, query, ctx);
  return wrap('asset-list', payload, meta, path, query);
}

async function rwa(parsed, ctx) {
  const query = compact({
    sort: parseSort(parsed.flags?.sort, RWA_SORTS, 'marketCap'),
    order: parseOrder(parsed.flags?.order),
    page: parsePage(parsed.flags?.page),
    limit: parseLimit(parsed.flags?.limit, 'limit', 50, 100),
  });
  const path = '/api/assets/rwa';
  const { data: payload, meta } = await getAssetData(path, query, ctx);
  return wrap('asset-rwa', payload, meta, path, query);
}

async function detail(parsed, ctx) {
  const id = assertPositiveInteger(parsed.target, 'asset id');
  const path = `/api/assets/${id}`;
  const { data: payload, meta } = await getAssetData(path, {}, ctx);
  return wrap('asset-detail', payload, meta, path);
}

async function klines(parsed, ctx) {
  const id = assertPositiveInteger(parsed.target, 'asset id');
  const query = compact({
    interval: parseInterval(parsed.flags?.interval),
    limit: parseLimit(parsed.flags?.limit, 'limit', 100, 500),
  });
  const path = `/api/assets/${id}/klines`;
  const { data: payload, meta } = await getAssetData(path, query, ctx);
  return wrap('asset-klines', payload, meta, path, query);
}

async function pairs(parsed, ctx) {
  const id = assertPositiveInteger(parsed.target, 'asset id');
  const query = compact({
    venue: parseEnum(parsed.flags?.venue, VENUES, 'all', 'venue'),
    marketType: parseEnum(parsed.flags?.['market-type'] || parsed.flags?.marketType, PAIR_MARKET_TYPES, 'all', 'market-type'),
    page: parsePage(parsed.flags?.page),
    limit: parseLimit(parsed.flags?.limit, 'limit', 100, 100),
  });
  const path = `/api/assets/${id}/tickers`;
  const { data: payload, meta } = await getAssetData(path, query, ctx);
  return wrap('asset-pairs', payload, meta, path, query);
}

async function secFilings(parsed, ctx) {
  const id = assertPositiveInteger(parsed.target, 'asset id');
  const query = compact({
    page: parsePage(parsed.flags?.page),
    limit: parseLimit(parsed.flags?.limit, 'limit', 20),
  });
  const path = `/api/assets/${id}/sec-filings`;
  const { data: payload, meta } = await getAssetData(path, query, ctx);
  return wrap('asset-sec-filings', payload, meta, path, query);
}

async function stats(parsed, ctx) {
  const path = '/api/global-stats';
  const { data: payload, meta } = await getAssetData(path, {}, ctx);
  return wrap('asset-stats', payload, meta, path);
}

export default { search, ls, list: ls, rwa, detail, klines, pairs, secFilings, stats };
