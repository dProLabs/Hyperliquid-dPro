import { getOnchain } from '../clients/onchain-client.mjs';
import { inputError } from '../errors.mjs';
import { assertAddress, assertCoin, assertPositiveInteger } from '../utils/validate.mjs';

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

function getFlag(flags = {}, ...names) {
  for (const name of names) {
    if (flags[name] != null) return flags[name];
  }
  return undefined;
}

function assertPositiveIntegerMax(value, label, max) {
  const n = assertPositiveInteger(value, label);
  if (n > max) {
    throw inputError(`${label} must be <= ${max}, got: "${value}"`);
  }
  return n;
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

function parseTradfiPeriod(value) {
  if (value == null) return undefined;
  const normalized = String(value).toLowerCase();
  if (normalized !== '24h') {
    throw inputError(`period must be 24h, got: "${value}"`);
  }
  return normalized;
}

function parsePredictionSide(value) {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || (n !== 0 && n !== 1)) {
    throw inputError(`side must be 0 or 1, got: "${value}"`);
  }
  return n;
}

function parsePredictionCoin(value) {
  const normalized = asOptionalString(value);
  if (!normalized) return undefined;
  if (!/^#\d+$/.test(normalized)) {
    throw inputError(`prediction coin must match #<number>, got: "${value}"`);
  }
  return normalized;
}

function parseCsv(value, label) {
  const normalized = asOptionalString(value);
  if (!normalized) return [];
  const items = normalized.split(',').map((item) => item.trim()).filter(Boolean);
  if (!items.length) throw inputError(`${label} must not be empty.`);
  return items;
}

function parsePredictionCoinsCsv(value) {
  const coins = parseCsv(value, 'coins').map(parsePredictionCoin);
  const deduped = [...new Set(coins)];
  if (deduped.length > 30) throw inputError('prediction batch supports at most 30 coins.');
  return deduped;
}

function parsePositiveIntegerCsv(value, label) {
  return parseCsv(value, label).map((item) => assertPositiveInteger(item, label));
}

function parsePredictionSidesCsv(value) {
  return parseCsv(value, 'sides').map(parsePredictionSide);
}

function parsePredictionSingleQuery(parsed, usage) {
  const coin = parsePredictionCoin(getFlag(parsed.flags, 'coin'));
  if (coin) {
    return compact({ coin, ...parsePageLimit(parsed.flags) });
  }

  const outcomeValue = parsed.target || getFlag(parsed.flags, 'outcomeId', 'outcome-id');
  const sideValue = getFlag(parsed.flags, 'side');
  if (outcomeValue == null || sideValue == null) throw inputError(usage);
  return compact({
    outcomeId: assertPositiveInteger(outcomeValue, 'outcomeId'),
    side: parsePredictionSide(sideValue),
    ...parsePageLimit(parsed.flags),
  });
}

function parsePredictionBatchQuery(parsed, usage) {
  const coinsValue = getFlag(parsed.flags, 'coins');
  const outcomeIdsValue = getFlag(parsed.flags, 'outcomeIds', 'outcome-ids');
  if (coinsValue != null) {
    const coins = parsePredictionCoinsCsv(coinsValue);
    return compact({
      coins: coins.join(','),
      ...parsePageLimit(parsed.flags),
    });
  }

  if (outcomeIdsValue == null) throw inputError(usage);
  const outcomeIds = parsePositiveIntegerCsv(outcomeIdsValue, 'outcomeIds');
  const sidesValue = getFlag(parsed.flags, 'sides');
  const sides = sidesValue == null ? [] : parsePredictionSidesCsv(sidesValue);
  const resolvedCount = outcomeIds.length * (sides.length || 2);
  if (resolvedCount > 30) throw inputError('prediction batch supports at most 30 resolved coins.');
  return compact({
    outcomeIds: outcomeIds.join(','),
    sides: sides.length ? sides.join(',') : undefined,
    ...parsePageLimit(parsed.flags),
  });
}

function parseSmartTraderSort(value) {
  if (value == null) return undefined;
  const normalized = String(value);
  const allowed = ['pnlPct', 'pnl', 'totalBuy', 'totalSell', 'portfolioValue', 'lastTradeAt'];
  if (!allowed.includes(normalized)) {
    throw inputError(`sort must be one of: ${allowed.join(', ')}. got: "${value}"`);
  }
  return normalized;
}

function parseSmartTraderPageLimit(flags = {}) {
  const query = {};
  if (flags.page != null) query.page = assertPositiveInteger(flags.page, 'page');
  if (flags.limit != null) query.limit = assertPositiveIntegerMax(flags.limit, 'limit', 500);
  return query;
}

function parseOptionalAddress(value) {
  const normalized = asOptionalString(value);
  return normalized ? assertAddress(normalized) : undefined;
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

async function predictionPositions(parsed, ctx) {
  const outcomeId = parsed.target || getFlag(parsed.flags, 'outcomeId', 'outcome-id');
  if (!outcomeId) {
    throw inputError('Usage: dpro-hl onchain prediction-positions <outcomeId> [--order asc|desc] [--address <wallet>] [--page N] [--limit N]');
  }
  const query = compact({
    outcomeId: assertPositiveInteger(outcomeId, 'outcomeId'),
    order: parseOrder(parsed.flags?.order),
    address: asOptionalString(parsed.flags?.address),
    ...parsePageLimit(parsed.flags),
  });
  const path = '/api/v1/hl/prediction/positions';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-prediction-positions', payload, path, query);
}

async function predictionOrdersBook(parsed, ctx) {
  const query = parsePredictionSingleQuery(
    parsed,
    'Usage: dpro-hl onchain prediction-orders-book [--coin <#N>|--outcome-id <N> --side 0|1] [--page N] [--limit N]',
  );
  const path = '/api/v1/hl/prediction/orders/book';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-prediction-orders-book', payload, path, query);
}

async function predictionOrdersBookBatch(parsed, ctx) {
  const query = parsePredictionBatchQuery(
    parsed,
    'Usage: dpro-hl onchain prediction-orders-book-batch [--coins <#N,#N>|--outcome-ids <N,N> [--sides 0,1]] [--page N] [--limit N]',
  );
  const path = '/api/v1/hl/prediction/orders/book/batch';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-prediction-orders-book-batch', payload, path, query);
}

async function predictionOrdersUntriggered(parsed, ctx) {
  const query = parsePredictionSingleQuery(
    parsed,
    'Usage: dpro-hl onchain prediction-orders-untriggered [--coin <#N>|--outcome-id <N> --side 0|1] [--page N] [--limit N]',
  );
  const path = '/api/v1/hl/prediction/orders/untriggered';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-prediction-orders-untriggered', payload, path, query);
}

async function predictionOrdersUntriggeredBatch(parsed, ctx) {
  const query = parsePredictionBatchQuery(
    parsed,
    'Usage: dpro-hl onchain prediction-orders-untriggered-batch [--coins <#N,#N>|--outcome-ids <N,N> [--sides 0,1]] [--page N] [--limit N]',
  );
  const path = '/api/v1/hl/prediction/orders/untriggered/batch';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-prediction-orders-untriggered-batch', payload, path, query);
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

async function tradfiVolumeTop(parsed, ctx) {
  const query = compact({
    period: parseTradfiPeriod(parsed.flags?.period),
    limit: parsed.flags?.limit == null ? undefined : assertPositiveIntegerMax(parsed.flags.limit, 'limit', 50),
  });
  const path = '/api/v1/hl/tradfi/volume-top';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-tradfi-volume-top', payload, path, query);
}

async function tradfiGainersTop(parsed, ctx) {
  const query = compact({
    period: parseTradfiPeriod(parsed.flags?.period),
    limit: parsed.flags?.limit == null ? undefined : assertPositiveIntegerMax(parsed.flags.limit, 'limit', 50),
  });
  const path = '/api/v1/hl/tradfi/gainers-top';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-tradfi-gainers-top', payload, path, query);
}

async function tradfiGainersHolderPnlTop(parsed, ctx) {
  const assetLimit = getFlag(parsed.flags, 'assetLimit', 'asset-limit');
  const holderLimit = getFlag(parsed.flags, 'holderLimit', 'holder-limit');
  const query = compact({
    period: parseTradfiPeriod(parsed.flags?.period),
    assetLimit: assetLimit == null ? undefined : assertPositiveIntegerMax(assetLimit, 'assetLimit', 50),
    holderLimit: holderLimit == null ? undefined : assertPositiveIntegerMax(holderLimit, 'holderLimit', 50),
  });
  const path = '/api/v1/hl/tradfi/gainers-holder-pnl-top';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-tradfi-gainers-holder-pnl-top', payload, path, query);
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

async function hip3SmartTrader(parsed, ctx) {
  const coin = parseCoin(
    parsed.target,
    'Usage: dpro-hl onchain hip3-smart-trader <coin> [--sort pnlPct|pnl|totalBuy|totalSell|portfolioValue|lastTradeAt] [--order asc|desc] [--address <wallet>] [--page N] [--limit N]',
  );
  const query = compact({
    coin,
    sort: parseSmartTraderSort(parsed.flags?.sort),
    order: parseOrder(parsed.flags?.order),
    address: parseOptionalAddress(parsed.flags?.address),
    ...parseSmartTraderPageLimit(parsed.flags),
  });
  const path = '/api/v1/hip3/smart-trader';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-hip3-smart-trader', payload, path, query);
}

async function hip4SmartTrader(parsed, ctx) {
  const tokenId = parsed.target || getFlag(parsed.flags, 'tokenId', 'token-id');
  if (!tokenId) {
    throw inputError('Usage: dpro-hl onchain hip4-smart-trader <tokenId> [--sort pnlPct|pnl|totalBuy|totalSell|portfolioValue|lastTradeAt] [--order asc|desc] [--address <wallet>] [--page N] [--limit N]');
  }
  const query = compact({
    tokenId: assertPositiveInteger(tokenId, 'tokenId'),
    sort: parseSmartTraderSort(parsed.flags?.sort),
    order: parseOrder(parsed.flags?.order),
    address: parseOptionalAddress(parsed.flags?.address),
    ...parseSmartTraderPageLimit(parsed.flags),
  });
  const path = '/api/v1/hip4/smart-trader';
  const payload = await getOnchain(path, query, ctx);
  return wrap('onchain-hip4-smart-trader', payload, path, query);
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
  predictionPositions,
  predictionOrdersBook,
  predictionOrdersBookBatch,
  predictionOrdersUntriggered,
  predictionOrdersUntriggeredBatch,
  liqmap,
  liqmapTimeline,
  trending,
  tradfiVolumeTop,
  tradfiGainersTop,
  tradfiGainersHolderPnlTop,
  liquidationMap,
  leaderboard,
  hip3Fills,
  hip3SmartTrader,
  hip4SmartTrader,
};
