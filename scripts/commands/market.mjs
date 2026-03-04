import * as infoClient from '../clients/info-client.mjs';
import { getAllMarkets, getPerpMarkets, findMarket, findRelatedSymbols } from '../resolvers/market-resolver.mjs';
import { isValidInterval, calcStartTime } from '../utils/time.mjs';
import { inputError, assetNotFound } from '../errors.mjs';
import { DEFAULT_BOOK_LEVELS, DEFAULT_CANDLE_COUNT, DEFAULT_MOVERS_TOP } from '../constants.mjs';

function asObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function pickQuoteMid(mids, market, coin) {
  const m = asObject(mids);
  const midsKeys = [market?.apiName, market?.coin, coin].filter(Boolean);
  for (const key of midsKeys) {
    if (m[key] != null) return m[key];
  }
  return null;
}

async function getAssetNotFoundError(coin, opts = {}) {
  const related = await findRelatedSymbols(coin, 6, opts);
  const hints = [];
  if (related.length) hints.push(`Related symbols: ${related.join(', ')}.`);
  if (String(coin).includes(':') || related.some(s => s.includes(':'))) {
    hints.push('AAPL and xyz:AAPL are different assets; use the exact coin from "hl markets ls".');
  }
  return assetNotFound(coin, hints.join(' '));
}

async function quote(parsed, ctx) {
  const coin = parsed.target;
  if (!coin) throw inputError('Usage: hl quote <coin>');
  const isTestnet = ctx?.network === 'testnet';
  const netOpts = { isTestnet };

  // Get all mids + market data in parallel
  const [mids, market] = await Promise.all([
    infoClient.getAllMids({ ...netOpts, dex: 'ALL_DEXS' }),
    findMarket(coin, netOpts),
  ]);

  const mid = pickQuoteMid(mids, market, coin);
  if (mid == null && !market) throw await getAssetNotFoundError(coin, netOpts);

  const data = { coin: market?.coin || coin, mid: mid ?? null };

  if (market?.ctx) {
    const ctx = market.ctx;
    if (ctx.prevDayPx && mid != null) {
      data.change24h = (Number(mid) - Number(ctx.prevDayPx)) / Number(ctx.prevDayPx);
    }
    if (ctx.funding != null) data.funding = Number(ctx.funding);
    if (ctx.openInterest != null) data.openInterest = Number(ctx.openInterest);
    if (ctx.markPx != null) data.markPx = ctx.markPx;
    if (ctx.oraclePx != null) data.oraclePx = ctx.oraclePx;
    if (ctx.dayNtlVlm != null) data.volume24h = Number(ctx.dayNtlVlm);
  }

  return { ok: true, type: 'quote', data };
}

async function book(parsed, ctx) {
  const coin = parsed.target;
  if (!coin) throw inputError('Usage: hl book <coin>');
  const isTestnet = ctx?.network === 'testnet';
  const netOpts = { isTestnet };

  const levels = Number(parsed.flags?.levels) || DEFAULT_BOOK_LEVELS;
  const market = await findMarket(coin, netOpts);
  const apiCoin = market?.apiName || market?.coin || coin;
  const result = await infoClient.getL2Book(apiCoin, undefined, undefined, netOpts);

  if (!result?.levels) throw await getAssetNotFoundError(coin, netOpts);

  const bids = (result.levels[0] || []).slice(0, levels).map(({ px, sz, n }) => ({ px, sz, n }));
  const asks = (result.levels[1] || []).slice(0, levels).map(({ px, sz, n }) => ({ px, sz, n }));

  let spread = null;
  if (asks.length && bids.length) {
    spread = Number(asks[0].px) - Number(bids[0].px);
  }

  return { ok: true, type: 'book', data: { coin: market?.coin || coin, levels, bids, asks, spread } };
}

async function candles(parsed, ctx) {
  const coin = parsed.target;
  if (!coin) throw inputError('Usage: hl candles <coin> --interval <iv> [--last <n>]');
  const isTestnet = ctx?.network === 'testnet';
  const netOpts = { isTestnet };

  const interval = parsed.flags?.interval || '1h';
  if (!isValidInterval(interval)) {
    throw inputError(`Invalid interval: ${interval}. Valid: 1m,3m,5m,15m,30m,1h,2h,4h,8h,12h,1d,3d,1w,1M`);
  }

  const count = Number(parsed.flags?.last) || DEFAULT_CANDLE_COUNT;
  const startTime = calcStartTime(interval, count);
  const market = await findMarket(coin, netOpts);
  const apiCoin = market?.apiName || market?.coin || coin;
  const result = await infoClient.getCandles(apiCoin, interval, startTime, undefined, netOpts);
  if (!result?.length && !market) {
    throw await getAssetNotFoundError(coin, netOpts);
  }

  const candleData = (result || []).map(c => ({
    t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v,
  }));

  return { ok: true, type: 'candles', data: { coin: market?.coin || coin, interval, candles: candleData } };
}

async function movers(parsed, ctx) {
  const top = Number(parsed.flags?.top) || DEFAULT_MOVERS_TOP;
  const side = parsed.flags?.side?.toLowerCase(); // gainers, losers, or null for both
  const isTestnet = ctx?.network === 'testnet';

  const markets = await getPerpMarkets({ isTestnet });

  const withChange = markets
    .filter(m => m.ctx?.prevDayPx && m.ctx?.markPx)
    .map(m => {
      const prev = Number(m.ctx.prevDayPx);
      const mark = Number(m.ctx.markPx);
      return {
        coin: m.coin,
        price: mark,
        change24h: (mark - prev) / prev,
      };
    })
    .sort((a, b) => b.change24h - a.change24h);

  let result;
  if (side === 'gainers') {
    result = withChange.filter(m => m.change24h > 0).slice(0, top);
  } else if (side === 'losers') {
    result = withChange.filter(m => m.change24h < 0).reverse().slice(0, top);
  } else {
    result = [...withChange.slice(0, top / 2), ...withChange.slice(-top / 2).reverse()];
  }

  return { ok: true, type: 'movers', data: { movers: result, side } };
}

async function overview(parsed, ctx) {
  const top = Number(parsed.flags?.top) || 5;
  const isTestnet = ctx?.network === 'testnet';
  const markets = await getPerpMarkets({ isTestnet });

  const withChange = markets
    .filter(m => m.ctx?.prevDayPx && m.ctx?.markPx)
    .map(m => {
      const prev = Number(m.ctx.prevDayPx);
      const mark = Number(m.ctx.markPx);
      return {
        coin: m.coin,
        price: mark,
        change24h: (mark - prev) / prev,
        funding: m.ctx.funding ? Number(m.ctx.funding) : null,
        oi: m.ctx.openInterest ? Number(m.ctx.openInterest) * mark : null,
      };
    })
    .sort((a, b) => b.change24h - a.change24h);

  const gainers = withChange.slice(0, top);
  const losers = [...withChange].reverse().slice(0, top);
  const highFunding = [...withChange]
    .filter(m => m.funding != null)
    .sort((a, b) => Math.abs(b.funding) - Math.abs(a.funding))
    .slice(0, top);
  const largeOI = [...withChange]
    .filter(m => m.oi != null)
    .sort((a, b) => b.oi - a.oi)
    .slice(0, top);

  return { ok: true, type: 'overview', data: { gainers, losers, highFunding, largeOI } };
}

async function marketsLs(parsed, ctx) {
  const isTestnet = ctx?.network === 'testnet';
  const markets = await getAllMarkets({ isTestnet });
  const data = markets.map(m => ({
    coin: m.coin,
    type: m.type,
    assetId: m.assetId,
    maxLeverage: m.maxLeverage || null,
  }));
  return { ok: true, type: 'markets-ls', data: { markets: data } };
}

export default { quote, book, candles, movers, overview, marketsLs };

export const __pickQuoteMidForTest = pickQuoteMid;
