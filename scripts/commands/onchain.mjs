import { getOnchain } from '../clients/onchain-client.mjs';
import { inputError } from '../errors.mjs';
import { assertCoin, assertPositiveInteger } from '../utils/validate.mjs';

function parseCoin(value, usage) {
  if (!value) throw inputError(usage);
  return normalizeOnchainCoin(assertCoin(value));
}

function normalizeOnchainCoin(coin) {
  const raw = String(coin);
  if (!raw.includes(':')) return raw;
  const [dex, symbol] = raw.split(':');
  if (!dex || !symbol) return raw;
  return `${dex.toLowerCase()}:${symbol.toUpperCase()}`;
}

function parsePageLimit(flags = {}) {
  const query = {};
  if (flags.page != null) query.page = assertPositiveInteger(flags.page, 'page');
  if (flags.limit != null) query.limit = assertPositiveInteger(flags.limit, 'limit');
  return query;
}

function parseOrder(value) {
  if (value == null) return undefined;
  const normalized = String(value).toLowerCase();
  if (normalized !== 'asc' && normalized !== 'desc') {
    throw inputError(`order must be "asc" or "desc", got: "${value}"`);
  }
  return normalized;
}

function wrap(type, payload, path, query = {}) {
  return {
    ok: true,
    type,
    data: {
      path,
      query,
      payload,
    },
  };
}

async function ping(parsed, ctx) {
  const path = '/api/v1';
  const payload = await getOnchain(path, {}, ctx);
  return wrap('onchain-ping', payload, path);
}

async function health(parsed, ctx) {
  const path = '/api/v1/health';
  const payload = await getOnchain(path, {}, ctx);
  return wrap('onchain-health', payload, path);
}

async function mids(parsed, ctx) {
  const path = '/api/v1/hl/prices/mids';
  const payload = await getOnchain(path, {}, ctx);
  return wrap('onchain-mids', payload, path);
}

async function spotMeta(parsed, ctx) {
  const path = '/api/v1/hl/meta/spot';
  const payload = await getOnchain(path, {}, ctx);
  return wrap('onchain-spot-meta', payload, path);
}

async function perpsMeta(parsed, ctx) {
  const path = '/api/v1/hl/meta/perps-universe';
  const payload = await getOnchain(path, {}, ctx);
  return wrap('onchain-perps-meta', payload, path);
}

async function spotHolders(parsed, ctx) {
  const coin = parseCoin(parsed.target, 'Usage: dpro-hl onchain spot-holders <coin> [--page N] [--limit N]');
  const query = {
    coin,
    ...parsePageLimit(parsed.flags),
  };
  const path = '/api/v1/hl/spot/holders';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-spot-holders', payload, path, query);
}

async function spotHolderCounts(parsed, ctx) {
  const path = '/api/v1/hl/spot/holders/counts';
  const payload = await getOnchain(path, {}, ctx);
  return wrap('onchain-spot-holder-counts', payload, path);
}

async function perpHolders(parsed, ctx) {
  const coin = parseCoin(parsed.target, 'Usage: dpro-hl onchain perp-holders <coin> [--sortBy field] [--order asc|desc] [--page N] [--limit N]');
  const query = {
    coin,
    sortBy: parsed.flags?.sortBy,
    order: parseOrder(parsed.flags?.order),
    ...parsePageLimit(parsed.flags),
  };
  const path = '/api/v1/hl/perp/holders';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-perp-holders', payload, path, query);
}

async function liquidationMap(parsed, ctx) {
  const coin = parseCoin(parsed.target, 'Usage: dpro-hl onchain liquidation-map <coin>');
  const query = { coin };
  const path = '/api/v1/hl/perp/liquidation-map';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-liquidation-map', payload, path, query);
}

async function leaderboard(parsed, ctx) {
  const query = {
    ...parsePageLimit(parsed.flags),
    sort: parsed.flags?.sort,
    order: parseOrder(parsed.flags?.order),
  };
  const path = '/api/v1/leaderboard';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-leaderboard', payload, path, query);
}

export default {
  ping,
  health,
  mids,
  spotMeta,
  perpsMeta,
  spotHolders,
  spotHolderCounts,
  perpHolders,
  liquidationMap,
  leaderboard,
};
