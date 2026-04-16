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

function asOptionalString(value) {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s || undefined;
}

function parseOrder(value) {
  if (value == null) return undefined;
  const normalized = String(value).toLowerCase();
  if (normalized !== 'asc' && normalized !== 'desc') {
    throw inputError(`order must be "asc" or "desc", got: "${value}"`);
  }
  return normalized;
}

function parseSortBy(value) {
  if (value == null) return undefined;
  const normalized = String(value).toLowerCase();
  if (normalized !== 'value' && normalized !== 'pnl') {
    throw inputError(`sortBy must be "value" or "pnl", got: "${value}"`);
  }
  return normalized;
}

function parseChartType(value) {
  if (value == null) return undefined;
  const normalized = String(value).toLowerCase();
  if (normalized !== 'book' && normalized !== 'untriggered') {
    throw inputError(`type must be "book" or "untriggered", got: "${value}"`);
  }
  return normalized;
}

function parseGroupBy(value) {
  if (value == null) return undefined;
  const normalized = String(value).toLowerCase();
  if (!['all', 'smart', 'whale'].includes(normalized)) {
    throw inputError(`groupBy must be one of: all, smart, whale. got: "${value}"`);
  }
  return normalized;
}

function parsePeriod(value) {
  if (value == null) return undefined;
  const normalized = String(value).toLowerCase();
  if (!['15m', '1h', '4h', '24h'].includes(normalized)) {
    throw inputError(`period must be one of: 15m, 1h, 4h, 24h. got: "${value}"`);
  }
  return normalized;
}

function parseTrendingMarket(value) {
  if (value == null) return undefined;
  const normalized = String(value).toLowerCase();
  if (!['all', 'spot', 'perp'].includes(normalized)) {
    throw inputError(`market must be one of: all, spot, perp. got: "${value}"`);
  }
  return normalized;
}

function parseIsoDate(value, label) {
  const normalized = asOptionalString(value);
  if (!normalized) {
    throw inputError(`Usage: dpro-hl onchain liqmap-timeline <coin> --from <ISO> --to <ISO>. Missing ${label}.`);
  }
  const ts = Date.parse(normalized);
  if (!Number.isFinite(ts)) {
    throw inputError(`Invalid ${label} timestamp: "${value}". Use ISO date format.`);
  }
  return normalized;
}

function compact(query = {}) {
  return Object.fromEntries(Object.entries(query).filter(([, v]) => v != null && v !== ''));
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

async function spotMeta() {
  return {
    ok: true,
    type: 'onchain-spot-meta-deprecated',
    data: {
      message:
        'Endpoint /api/v1/hl/meta/spot has been removed upstream. Use "dpro-hl onchain spot-holder-counts", "dpro-hl markets ls", or "dpro-hl onchain perps-meta" instead.',
    },
  };
}

async function perpsMeta(parsed, ctx) {
  const path = '/api/v1/hl/meta/perps-universe';
  const payload = await getOnchain(path, {}, ctx);
  return wrap('onchain-perps-meta', payload, path);
}

async function addressTags(parsed, ctx) {
  const path = '/api/v1/hl/meta/address-tags';
  const payload = await getOnchain(path, {}, ctx);
  return wrap('onchain-address-tags', payload, path);
}

async function spotHolders(parsed, ctx) {
  const coin = parseCoin(
    parsed.target,
    'Usage: dpro-hl onchain spot-holders <coin> [--order asc|desc] [--address <wallet>] [--page N] [--limit N]',
  );
  const query = compact({
    coin,
    order: parseOrder(parsed.flags?.order),
    address: asOptionalString(parsed.flags?.address),
    ...parsePageLimit(parsed.flags),
  });
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
  const coin = parseCoin(
    parsed.target,
    'Usage: dpro-hl onchain perp-holders <coin> [--sortBy value|pnl] [--order asc|desc] [--address <wallet>] [--page N] [--limit N]',
  );
  const query = compact({
    coin,
    sortBy: parseSortBy(parsed.flags?.sortBy),
    order: parseOrder(parsed.flags?.order),
    address: asOptionalString(parsed.flags?.address),
    ...parsePageLimit(parsed.flags),
  });
  const path = '/api/v1/hl/perp/holders';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-perp-holders', payload, path, query);
}

async function ordersBook(parsed, ctx) {
  const coin = parseCoin(parsed.target, 'Usage: dpro-hl onchain orders-book <coin> [--page N] [--limit N]');
  const query = compact({
    coin,
    ...parsePageLimit(parsed.flags),
  });
  const path = '/api/v1/hl/orders/book';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-orders-book', payload, path, query);
}

async function ordersUntriggered(parsed, ctx) {
  const coin = parseCoin(
    parsed.target,
    'Usage: dpro-hl onchain orders-untriggered <coin> [--page N] [--limit N]',
  );
  const query = compact({
    coin,
    ...parsePageLimit(parsed.flags),
  });
  const path = '/api/v1/hl/orders/untriggered';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-orders-untriggered', payload, path, query);
}

async function ordersChart(parsed, ctx) {
  const coin = parseCoin(
    parsed.target,
    'Usage: dpro-hl onchain orders-chart <coin> [--type book|untriggered]',
  );
  const query = compact({
    coin,
    type: parseChartType(parsed.flags?.type),
  });
  const path = '/api/v1/hl/orders/chart';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-orders-chart', payload, path, query);
}

async function liqmap(parsed, ctx) {
  const coin = parseCoin(parsed.target, 'Usage: dpro-hl onchain liqmap <coin> [--groupBy all|smart|whale]');
  const query = compact({
    coin,
    groupBy: parseGroupBy(parsed.flags?.groupBy),
  });
  const path = '/api/v1/hl/liqmap';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-liquidation-map', payload, path, query);
}

async function liquidationMap(parsed, ctx) {
  return liqmap(parsed, ctx);
}

async function liqmapTimeline(parsed, ctx) {
  const coin = parseCoin(
    parsed.target,
    'Usage: dpro-hl onchain liqmap-timeline <coin> --from <ISO> --to <ISO>',
  );
  const query = {
    coin,
    from: parseIsoDate(parsed.flags?.from, 'from'),
    to: parseIsoDate(parsed.flags?.to, 'to'),
  };
  const path = '/api/v1/hl/liqmap/timeline';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-liqmap-timeline', payload, path, query);
}

async function trending(parsed, ctx) {
  const query = compact({
    period: parsePeriod(parsed.flags?.period),
    market: parseTrendingMarket(parsed.flags?.market),
    ...parsePageLimit(parsed.flags),
  });
  const path = '/api/v1/hl/trending';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-trending', payload, path, query);
}

async function leaderboard(parsed, ctx) {
  const query = compact({
    ...parsePageLimit(parsed.flags),
    sort: asOptionalString(parsed.flags?.sort),
    order: parseOrder(parsed.flags?.order),
  });
  const path = '/api/v1/leaderboard';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-leaderboard', payload, path, query);
}

async function hip3Fills(parsed, ctx) {
  const coin = parseCoin(
    parsed.target,
    'Usage: dpro-hl onchain hip3-fills <coin> [--startTime <ISO|ms>] [--endTime <ISO|ms>] [--page N] [--limit N]',
  );
  const query = compact({
    coin,
    startTime: asOptionalString(parsed.flags?.startTime || parsed.flags?.['start-time']),
    endTime: asOptionalString(parsed.flags?.endTime || parsed.flags?.['end-time']),
    ...parsePageLimit(parsed.flags),
  });
  const path = '/api/v1/hip3/fills';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-hip3-fills', payload, path, query);
}

export default {
  ping,
  health,
  mids,
  spotMeta,
  perpsMeta,
  addressTags,
  spotHolders,
  spotHolderCounts,
  perpHolders,
  ordersBook,
  ordersUntriggered,
  ordersChart,
  liqmap,
  liqmapTimeline,
  trending,
  liquidationMap,
  leaderboard,
  hip3Fills,
};
