import { DEFAULT_NEWS_LIMIT } from '../constants.mjs';
import { getNews } from '../clients/news-client.mjs';
import { inputError } from '../errors.mjs';
import { assertPositiveInteger } from '../utils/validate.mjs';

const NEWS_CATEGORIES = new Set(['all', 'hot-24h', 'hot-7d']);
const ASSET_TYPES = new Set(['CRYPTO', 'STOCK', 'ETF', 'FOREX', 'COMMODITY', 'ALL']);

function compact(query = {}) {
  return Object.fromEntries(Object.entries(query).filter(([, v]) => v != null && v !== ''));
}

function asOptionalString(value) {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s || undefined;
}

function parseLimit(value) {
  const limit = value == null ? DEFAULT_NEWS_LIMIT : assertPositiveInteger(value, 'limit');
  if (limit > 100) throw inputError(`limit must be <= 100, got: "${value}"`);
  return limit;
}

function parsePage(value) {
  return value == null ? 1 : assertPositiveInteger(value, 'page');
}

function parseAssetId(value) {
  if (value == null) return undefined;
  return assertPositiveInteger(value, 'assetId');
}

function parseCategory(value) {
  if (value == null) return undefined;
  const category = String(value).trim().toLowerCase();
  if (!NEWS_CATEGORIES.has(category)) {
    throw inputError(`category must be one of: all, hot-24h, hot-7d. got: "${value}"`);
  }
  return category;
}

function parseType(value) {
  if (value == null) return undefined;
  const type = String(value).trim().toUpperCase();
  if (!ASSET_TYPES.has(type)) {
    throw inputError(`type must be one of: CRYPTO, STOCK, ETF, FOREX, COMMODITY, ALL. got: "${value}"`);
  }
  return type;
}

function parseAssetSymbol(parsed) {
  return asOptionalString(parsed.flags?.asset || parsed.flags?.['asset-symbol'] || parsed.target);
}

async function list(parsed, ctx) {
  const query = compact({
    assetId: parseAssetId(parsed.flags?.assetId || parsed.flags?.['asset-id']),
    assetSymbol: parseAssetSymbol(parsed),
    type: parseType(parsed.flags?.type),
    category: parseCategory(parsed.flags?.category),
    locale: asOptionalString(parsed.flags?.locale),
    page: parsePage(parsed.flags?.page),
    limit: parseLimit(parsed.flags?.limit),
  });
  const path = '/api/news';
  const { data: payload, meta } = await getNews(path, query, ctx);
  return {
    ok: true,
    type: 'news-list',
    data: { path, query, payload, meta },
  };
}

async function detail(parsed, ctx) {
  const id = assertPositiveInteger(parsed.target, 'news id');
  const query = compact({
    assetId: parseAssetId(parsed.flags?.assetId || parsed.flags?.['asset-id']),
    assetSymbol: asOptionalString(parsed.flags?.asset || parsed.flags?.['asset-symbol']),
    locale: asOptionalString(parsed.flags?.locale),
  });
  const path = `/api/news/${id}`;
  const { data: payload, meta } = await getNews(path, query, ctx);
  return {
    ok: true,
    type: 'news-detail',
    data: { path, query, payload, meta },
  };
}

export default { list, detail };
