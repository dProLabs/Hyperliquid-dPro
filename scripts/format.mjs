import { SkillError } from './errors.mjs';

// --- Number formatting helpers ---

export function fmtPx(n) {
  if (n == null) return '—';
  const num = Number(n);
  if (num >= 1000) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (num >= 1) return num.toFixed(4);
  return num.toPrecision(4);
}

export function fmtNum(n, decimals = 2) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPct(n) {
  if (n == null) return '—';
  const pct = Number(n) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function fmtUsd(n) {
  if (n == null) return '—';
  return '$' + fmtNum(n, 2);
}

// --- Table rendering ---

function padRight(s, w) { return String(s).padEnd(w); }
function padLeft(s, w) { return String(s).padStart(w); }

export function renderTable(headers, rows, alignRight = []) {
  const widths = headers.map((h, i) => {
    const colW = Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length));
    return colW;
  });

  const lines = [];
  lines.push(headers.map((h, i) => padRight(h, widths[i])).join('  '));
  lines.push(widths.map(w => '─'.repeat(w)).join('──'));
  for (const row of rows) {
    lines.push(row.map((cell, i) => {
      const s = String(cell ?? '');
      return alignRight.includes(i) ? padLeft(s, widths[i]) : padRight(s, widths[i]);
    }).join('  '));
  }
  return lines.join('\n');
}

function firstArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function unwrapOnchainPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  if (Object.prototype.hasOwnProperty.call(payload, 'data') && Object.prototype.hasOwnProperty.call(payload, 'code')) {
    return payload.data;
  }
  return payload;
}

function normalizeMidsPayload(payload) {
  const unwrapped = unwrapOnchainPayload(payload);
  if (!unwrapped || typeof unwrapped !== 'object' || Array.isArray(unwrapped)) return {};
  if (unwrapped.mids && typeof unwrapped.mids === 'object' && !Array.isArray(unwrapped.mids)) {
    return unwrapped.mids;
  }
  return unwrapped;
}

function deriveRank(row, index, query = {}) {
  if (row?.rank != null && row.rank !== '') return row.rank;
  const pageNum = Number(query.page);
  const limitNum = Number(query.limit);
  if (Number.isInteger(pageNum) && pageNum > 0 && Number.isInteger(limitNum) && limitNum > 0) {
    return (pageNum - 1) * limitNum + index + 1;
  }
  return index + 1;
}

function getLeaderboardUser(row) {
  if (!row || typeof row !== 'object') return '—';
  if (typeof row.displayName === 'string' && row.displayName) return row.displayName;
  if (row.displayName && typeof row.displayName === 'object') {
    const name = row.displayName.name || row.displayName.value || row.displayName.text;
    if (name) return name;
  }
  return row.user || row.address || row.ethAddress || row.wallet || row.trader || '—';
}

function getLeaderboardMetric(row, sortField = 'pnl_day') {
  if (!row || typeof row !== 'object') return '—';
  const direct = row[sortField] ?? row[sortField.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
  if (direct != null) return direct;

  const [metric, window] = String(sortField).split('_');
  if (metric === 'accountValue' && row.accountValue != null) return row.accountValue;

  const wp = Array.isArray(row.windowPerformances) ? row.windowPerformances : null;
  if (wp) {
    for (const entry of wp) {
      if (entry == null || typeof entry !== 'object') continue;
      const w = String(entry.window || entry.period || entry.timeframe || '').toLowerCase();
      if (!window || w === window.toLowerCase()) {
        if (entry[metric] != null) return entry[metric];
        if (entry[sortField] != null) return entry[sortField];
        if (entry.value != null) return entry.value;
      }
    }
    for (const entry of wp) {
      if (entry == null || typeof entry !== 'object') continue;
      if (entry[metric] != null) return entry[metric];
      if (entry.value != null) return entry.value;
    }
  }

  return row.pnl ?? row.pnL ?? row.value ?? row.accountValue ?? '—';
}

function normalizeOrdersPayload(payload) {
  const unwrapped = unwrapOnchainPayload(payload);
  if (!unwrapped || typeof unwrapped !== 'object' || Array.isArray(unwrapped)) {
    return { coin: '—', orders: [], pagination: null };
  }
  const orders = Array.isArray(unwrapped.orders)
    ? unwrapped.orders
    : Array.isArray(unwrapped.items)
      ? unwrapped.items
      : firstArray(unwrapped);
  return {
    coin: unwrapped.coin || '—',
    orders,
    pagination: unwrapped.pagination || null,
  };
}

function formatTime(value) {
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function fmtPctLiteral(value) {
  if (value == null || value === '') return '—';
  const raw = String(value);
  if (raw.endsWith('%')) return raw;
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return `${fmtNum(n, 2)}%`;
}

function formatPredictionOrders(d, title) {
  const normalized = normalizeOrdersPayload(d.payload);
  const payload = unwrapOnchainPayload(d.payload) || {};
  const subtitle = [
    `Path: ${d.path}`,
    `Coin: ${normalized.coin}`,
    `Outcome: ${payload.outcomeId ?? d.query?.outcomeId ?? '—'}`,
    `Side: ${payload.side ?? d.query?.side ?? '—'}`,
    `Pagination: ${formatPagination(normalized.pagination)}`,
  ].join('\n');
  if (!normalized.orders.length) return `${title}\n${subtitle}\nNo orders.`;
  const rows = normalized.orders.slice(0, 20).map((row) => ([
    row.oid ?? '—',
    row.side ?? '—',
    fmtNum(row.size ?? row.sz ?? row.origSize, 4),
    fmtPx(row.price ?? row.limitPx),
    row.triggerPx ?? '—',
  ]));
  return `${title}\n${subtitle}\n\n`
    + renderTable(['OID', 'Side', 'Size', 'Price', 'Trigger Px'], rows, [2, 3, 4]);
}

function formatPredictionOrdersBatch(d, title) {
  const payload = unwrapOnchainPayload(d.payload) || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return `${title}\nPath: ${d.path}\nNo items.`;
  const rows = items.slice(0, 20).map((item) => [
    item.coin || '—',
    item.outcomeId ?? '—',
    item.side ?? '—',
    Array.isArray(item.orders) ? item.orders.length : 0,
    formatPagination(item.pagination),
  ]);
  const summary = payload.summary
    ? `Requested: ${payload.summary.requested ?? '—'}, Returned: ${payload.summary.returned ?? '—'}, Snapshot: ${payload.summary.snapshotHeight ?? '—'}`
    : 'Summary: —';
  return `${title}\nPath: ${d.path}\n${summary}\n\n`
    + renderTable(['Coin', 'Outcome', 'Side', 'Orders', 'Pagination'], rows, [1, 2, 3]);
}

function formatTradfiTop(d, title) {
  const payload = unwrapOnchainPayload(d.payload) || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return `${title}\nPath: ${d.path}\nNo assets.`;
  const rows = items.slice(0, 20).map((item) => [
    item.coin || '—',
    item.displayName || '—',
    fmtPx(item.price),
    fmtPctLiteral(item.changePercent24h),
    fmtNum(item.volume24hUsd, 2),
    fmtNum(item.openInterestUsd, 2),
    item.maxLeverage ?? '—',
  ]);
  return `${title}\nPath: ${d.path}\nPeriod: ${payload.period || d.query?.period || '24h'}\n\n`
    + renderTable(['Coin', 'Name', 'Price', '24h %', 'Volume', 'OI', 'MaxLev'], rows, [2, 3, 4, 5, 6]);
}

function formatSmartTrader(d, title, idLabel) {
  const payload = unwrapOnchainPayload(d.payload) || {};
  const items = Array.isArray(payload.items) ? payload.items : firstArray(payload);
  const idValue = payload.coin || payload.tokenId || d.query?.coin || d.query?.tokenId || '—';
  if (!items.length) return `${title}\nPath: ${d.path}\n${idLabel}: ${idValue}\nNo traders.`;
  const rows = items.slice(0, 20).map((item, idx) => [
    deriveRank(item, idx, d.query),
    item.userAddress || item.address || '—',
    fmtNum(item.pnl ?? item.realizedPnl, 2),
    fmtPctLiteral(item.pnlPct),
    fmtNum(item.totalBuyUsd ?? item.totalBuy, 2),
    fmtNum(item.totalSellUsd ?? item.totalSell, 2),
    fmtNum(item.currentPortfolioValue ?? item.portfolioValue, 2),
    item.tradeCount ?? '—',
    formatTime(item.lastTradeAt),
  ]);
  return `${title}\nPath: ${d.path}\n${idLabel}: ${idValue}\nMark: ${fmtPx(payload.markPx)}\nPagination: ${formatPagination(payload.pagination)}\n\n`
    + renderTable(['Rank', 'User', 'PnL', 'PnL %', 'Buy', 'Sell', 'Portfolio', 'Trades', 'Last Trade'], rows, [0, 2, 3, 4, 5, 6, 7]);
}

function formatPagination(pagination) {
  if (!pagination || typeof pagination !== 'object') return '—';
  const page = pagination.page ?? '—';
  const limit = pagination.limit ?? '—';
  const total = pagination.total ?? '—';
  return `page=${page}, limit=${limit}, total=${total}`;
}

function fmtDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function compactText(value, max = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '—';
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function compactBlock(value, max = 900) {
  const text = String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) return '—';
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function newsAssetSymbols(assets) {
  if (!Array.isArray(assets) || !assets.length) return '—';
  return compactText(assets.map(a => a?.symbol || a?.name).filter(Boolean).join(', '), 32);
}

function newsDirection(row) {
  const display = row?.directionDisplay;
  if (display?.direction) return display.direction;
  const analysisDirection = row?.analysis?.direction;
  return analysisDirection ? String(analysisDirection).toLowerCase() : '—';
}

function newsDirectionDetail(row) {
  const display = row?.directionDisplay;
  if (display?.direction) {
    const affected = display.affectedAssets ? ` (${compactText(display.affectedAssets, 80)})` : '';
    return `${display.direction}${affected}`;
  }
  if (row?.analysis?.direction) return row.analysis.direction;
  return '—';
}

function normalizeNewsListPayload(payload) {
  const unwrapped = unwrapOnchainPayload(payload);
  if (Array.isArray(unwrapped)) {
    return { items: unwrapped, total: unwrapped.length, page: null, limit: null };
  }
  if (!unwrapped || typeof unwrapped !== 'object') {
    return { items: [], total: 0, page: null, limit: null };
  }
  return {
    items: Array.isArray(unwrapped.items) ? unwrapped.items : firstArray(unwrapped),
    total: unwrapped.total,
    page: unwrapped.page,
    limit: unwrapped.limit,
  };
}

function formatNewsFilters(query = {}) {
  const filters = [];
  if (query.assetSymbol) filters.push(`asset=${query.assetSymbol}`);
  if (query.assetId) filters.push(`assetId=${query.assetId}`);
  if (query.type) filters.push(`type=${query.type}`);
  if (query.category) filters.push(`category=${query.category}`);
  if (query.locale) filters.push(`locale=${query.locale}`);
  return filters.length ? `Filters: ${filters.join(', ')}` : 'Filters: all';
}

// --- Result formatters by type ---

const formatters = {
  help: (d) => d.message,

  quote: (d) => {
    const lines = [d.coin];
    lines.push(`Mid: ${fmtPx(d.mid)}`);
    if (d.change24h != null) lines.push(`24h: ${fmtPct(d.change24h)}`);
    if (d.funding != null) lines.push(`Funding: ${fmtPct(d.funding)}`);
    if (d.openInterest != null) lines.push(`OI: ${fmtUsd(d.openInterest)}`);
    if (d.markPx != null) lines.push(`Mark: ${fmtPx(d.markPx)}`);
    if (d.oraclePx != null) lines.push(`Oracle: ${fmtPx(d.oraclePx)}`);
    if (d.volume24h != null) lines.push(`Vol 24h: ${fmtUsd(d.volume24h)}`);
    return lines.join('\n');
  },

  book: (d) => {
    const lines = [`${d.coin} Order Book (Top ${d.levels})`];
    lines.push('');
    lines.push('Asks');
    for (const { px, sz } of [...d.asks].reverse()) {
      lines.push(`  ${fmtPx(px)}  x  ${fmtNum(sz, 4)}`);
    }
    lines.push('');
    lines.push('Bids');
    for (const { px, sz } of d.bids) {
      lines.push(`  ${fmtPx(px)}  x  ${fmtNum(sz, 4)}`);
    }
    if (d.spread != null) lines.push(`\nSpread: ${fmtPx(d.spread)}`);
    return lines.join('\n');
  },

  candles: (d) => {
    const headers = ['Time', 'Open', 'High', 'Low', 'Close', 'Volume'];
    const rows = d.candles.map(c => [
      new Date(c.t).toISOString().slice(0, 16).replace('T', ' '),
      fmtPx(c.o), fmtPx(c.h), fmtPx(c.l), fmtPx(c.c), fmtNum(c.v, 2),
    ]);
    return `${d.coin} ${d.interval} Candles (${d.candles.length})\n\n` + renderTable(headers, rows, [1, 2, 3, 4, 5]);
  },

  movers: (d) => {
    const headers = ['Coin', 'Price', '24h Change'];
    const rows = d.movers.map(m => [m.coin, fmtPx(m.price), fmtPct(m.change24h)]);
    const title = d.side ? `Top ${d.movers.length} ${d.side}` : `Top ${d.movers.length} Movers`;
    return title + '\n\n' + renderTable(headers, rows, [1, 2]);
  },

  overview: (d) => {
    const sections = [];
    if (d.gainers?.length) {
      sections.push('Top Gainers\n' + d.gainers.map(m => `  ${m.coin}: ${fmtPx(m.price)} ${fmtPct(m.change24h)}`).join('\n'));
    }
    if (d.losers?.length) {
      sections.push('Top Losers\n' + d.losers.map(m => `  ${m.coin}: ${fmtPx(m.price)} ${fmtPct(m.change24h)}`).join('\n'));
    }
    if (d.highFunding?.length) {
      sections.push('High Funding\n' + d.highFunding.map(m => `  ${m.coin}: ${fmtPct(m.funding)}`).join('\n'));
    }
    if (d.largeOI?.length) {
      sections.push('Large OI\n' + d.largeOI.map(m => `  ${m.coin}: ${fmtUsd(m.oi)}`).join('\n'));
    }
    return 'Market Overview\n\n' + sections.join('\n\n');
  },

  'markets-ls': (d) => {
    const headers = ['Coin', 'Type', 'Asset ID', 'Max Leverage'];
    const rows = d.markets.map(m => [m.coin, m.type, m.assetId, m.maxLeverage || '—']);
    return `Markets (${d.markets.length})\n\n` + renderTable(headers, rows, [2, 3]);
  },

  'news-list': (d) => {
    const payload = normalizeNewsListPayload(d.payload);
    const totalText = payload.total != null ? ` of ${payload.total}` : '';
    const lines = [
      `News (${payload.items.length}${totalText})`,
      formatNewsFilters(d.query),
      `Page: ${payload.page ?? d.query?.page ?? '—'}  Limit: ${payload.limit ?? d.query?.limit ?? '—'}`,
    ];
    if (d.meta?.cache) lines.push(`Cache: ${d.meta.cache}`);
    if (!payload.items.length) return `${lines.join('\n')}\n\nNo news found.`;

    const rows = payload.items.slice(0, 20).map((item) => [
      item.id ?? '—',
      fmtDateTime(item.publishedAt),
      newsAssetSymbols(item.assets),
      newsDirection(item),
      compactText(item.title || item.summary, 88),
    ]);
    return `${lines.join('\n')}\n\n` + renderTable(['ID', 'Published', 'Assets', 'Dir', 'Title'], rows, [0]);
  },

  'news-detail': (d) => {
    const item = unwrapOnchainPayload(d.payload) || {};
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return `News detail\nPath: ${d.path}\n` + JSON.stringify(item, null, 2);
    }

    const lines = [`News #${item.id ?? '—'}`];
    lines.push(compactBlock(item.title || '(untitled)', 300));
    lines.push('');
    lines.push(`Published: ${fmtDateTime(item.publishedAt)}`);
    lines.push(`Source: ${item.source || '—'}${item.publisher ? ` / ${item.publisher}` : ''}`);
    lines.push(`Assets: ${newsAssetSymbols(item.assets)}`);
    lines.push(`Direction: ${newsDirectionDetail(item)}`);
    if (item.sentiment != null) lines.push(`Sentiment: ${item.sentiment}`);
    if (item.contentClass) lines.push(`Content class: ${item.contentClass}`);
    if (d.meta?.cache) lines.push(`Cache: ${d.meta.cache}`);

    if (item.summary) {
      lines.push('');
      lines.push('Summary:');
      lines.push(compactBlock(item.summary, 900));
    }

    const analysis = item.analysis;
    if (analysis && typeof analysis === 'object') {
      lines.push('');
      lines.push(`Analysis (${analysis.locale || 'en'}):`);
      if (analysis.coreSummary) lines.push(`Core summary: ${compactBlock(analysis.coreSummary, 900)}`);
      if (analysis.impactLogic) lines.push(`Impact logic: ${compactBlock(analysis.impactLogic, 900)}`);
      if (analysis.timeHorizon) lines.push(`Time horizon: ${compactBlock(analysis.timeHorizon, 300)}`);
      if (analysis.risksAndWatchlist) lines.push(`Risks/watchlist: ${compactBlock(analysis.risksAndWatchlist, 900)}`);
    }

    if (item.url) {
      lines.push('');
      lines.push(`URL: ${item.url}`);
    }

    return lines.join('\n');
  },

  'account-ls': (d) => {
    if (!d.accounts.length) {
      const table = renderTable(['Alias', 'MasterAddress', 'AgentAddress', 'Mode', 'MasterKey', 'Default'], []);
      const hint = [
        'No accounts configured.',
        'Next steps:',
        '1. Connect wallet and sign in to Hyperliquid: https://app.hyperliquid.xyz/join/DPRO1',
        '2. Create an API wallet at https://app.hyperliquid.xyz/API',
        '3. Run: dpro-hl account add-api <masterAddress> <agentPrivKey> [alias]  --api-password <password>',
        '4. Optional read-only mode: dpro-hl account add-readonly <address> [alias]',
      ].join('\n');
      return `Accounts (0)\n\n${table}\n\n${hint}`;
    }
    const headers = ['Alias', 'MasterAddress', 'AgentAddress', 'Mode', 'MasterKey', 'Default'];
    const rows = d.accounts.map(a => [
      a.alias,
      a.masterAddress.slice(0, 10) + '...',
      a.mode === 'api' && a.agentAddress ? (a.agentAddress.slice(0, 10) + '...') : '—',
      a.mode,
      a.hasMasterKey ? 'yes' : 'no',
      a.isDefault ? '*' : '',
    ]);
    return `Accounts (${d.accounts.length})\n\n` + renderTable(headers, rows);
  },

  'account-added': (d) => `Account "${d.alias}" added (${d.mode}, ${d.masterAddress.slice(0, 10)}...)`,
  'master-key-added': (d) => `Master key added for ${d.masterAddress}.`,
  'master-key-updated': (d) => `Master key updated for ${d.masterAddress}.`,
  'master-key-removed': (d) => `Master key removed for ${d.masterAddress}.`,
  'account-removed': (d) => `Account "${d.alias}" removed.`,
  'account-default-set': (d) => `Default account set to "${d.alias}".`,
  'password-cache-cleared': () => 'Password session cache cleared.',

  positions: (d) => {
    if (!d.positions.length) return 'No open positions.';
    const headers = ['Coin', 'Side', 'Size', 'Entry', 'Mark', 'uPnL', 'Leverage'];
    const rows = d.positions.map(p => [
      p.coin, p.side, fmtNum(p.size, 4), fmtPx(p.entryPx),
      fmtPx(p.markPx), fmtUsd(p.unrealizedPnl), p.leverage || '—',
    ]);
    return renderTable(headers, rows, [2, 3, 4, 5, 6]);
  },

  balances: (d) => {
    const lines = [];
    if (d.perpEquity != null) {
      lines.push(`Perp Account Equity: ${fmtUsd(d.perpEquity)}`);
      lines.push(`Available Balance: ${fmtUsd(d.availableBalance)}`);
    }
    if (d.spotBalances?.length) {
      lines.push('\nSpot Balances');
      for (const b of d.spotBalances) {
        lines.push(`  ${b.coin}: ${fmtNum(b.total, 4)} (hold: ${fmtNum(b.hold, 4)})`);
      }
    }
    return lines.length ? lines.join('\n') : 'No balances found.';
  },

  orders: (d) => {
    if (!d.orders.length) return 'No open orders.';
    const headers = ['OID', 'Coin', 'Side', 'Size', 'Price', 'Type'];
    const rows = d.orders.map(o => [
      o.oid, o.coin, o.side, fmtNum(o.sz, 4), fmtPx(o.limitPx), o.orderType || '—',
    ]);
    return renderTable(headers, rows, [3, 4]);
  },

  fills: (d) => {
    if (!d.fills.length) return 'No recent fills.';
    const headers = ['Time', 'Coin', 'Side', 'Size', 'Price', 'Fee'];
    const rows = d.fills.map(f => [
      new Date(f.time).toISOString().slice(0, 19).replace('T', ' '),
      f.coin, f.side, fmtNum(f.sz, 4), fmtPx(f.px), fmtUsd(f.fee),
    ]);
    return renderTable(headers, rows, [3, 4, 5]);
  },

  'order-history': (d) => {
    if (!d.orders.length) return 'No historical orders.';
    const headers = ['Time', 'OID', 'Coin', 'Side', 'Size', 'Price', 'Status'];
    const rows = d.orders.map((o) => [
      o.time ? new Date(Number(o.time)).toISOString().slice(0, 19).replace('T', ' ') : '—',
      o.oid || '—',
      o.coin || '—',
      o.side || '—',
      fmtNum(o.sz, 4),
      fmtPx(o.px),
      o.status || '—',
    ]);
    return renderTable(headers, rows, [4, 5]);
  },

  'funding-history': (d) => {
    if (!d.items.length) return 'No funding history.';
    const headers = ['Time', 'Coin', 'USDC', 'SZI', 'Funding Rate', 'Hash'];
    const rows = d.items.map((item) => [
      item.time ? new Date(Number(item.time)).toISOString().slice(0, 19).replace('T', ' ') : '—',
      item.coin || '—',
      fmtUsd(item.usdc),
      fmtNum(item.szi, 4),
      fmtNum(item.fundingRate, 6),
      item.hash ? `${String(item.hash).slice(0, 10)}...` : '—',
    ]);
    return renderTable(headers, rows, [2, 3, 4]);
  },

  'twap-history': (d) => {
    if (!d.items.length) return 'No TWAP history.';
    const headers = ['Time', 'TWAP ID', 'Coin', 'Side', 'Size', 'Executed', 'Minutes', 'Status'];
    const rows = d.items.map((item) => [
      item.time ? new Date(Number(item.time)).toISOString().slice(0, 19).replace('T', ' ') : '—',
      item.twapId ?? '—',
      item.coin || '—',
      item.side || '—',
      fmtNum(item.sz, 4),
      fmtNum(item.executedSz, 4),
      item.minutes ?? '—',
      item.error ? `${item.status}: ${item.error}` : (item.status || '—'),
    ]);
    return renderTable(headers, rows, [4, 5, 6]);
  },

  'twap-fill-history': (d) => {
    if (!d.fills.length) return 'No TWAP fill history.';
    const headers = ['Time', 'TWAP ID', 'Coin', 'Side', 'Size', 'Price', 'Fee', 'OID'];
    const rows = d.fills.map((f) => [
      f.time ? new Date(Number(f.time)).toISOString().slice(0, 19).replace('T', ' ') : '—',
      f.twapId ?? '—',
      f.coin || '—',
      f.side || '—',
      fmtNum(f.sz, 4),
      fmtPx(f.px),
      fmtUsd(f.fee),
      f.oid ?? '—',
    ]);
    return renderTable(headers, rows, [4, 5, 6]);
  },

  order_result: (d) => {
    if (d.status === 'filled') return `Order filled: ${d.coin} ${d.side} ${d.size} @ ${fmtPx(d.price)}`;
    if (d.status === 'resting') return `Order resting: ${d.coin} ${d.side} ${d.size} @ ${fmtPx(d.price)} (oid: ${d.oid})`;
    if (d.status === 'error') {
      if (d.errorClass === 'INSUFFICIENT_MARGIN') {
        return `Order rejected by venue: insufficient balance or margin (${d.error}).`;
      }
      return `Order error: ${d.error}`;
    }
    return `Order status: ${d.status}`;
  },

  modify_result: (d) => {
    if (d.status === 'error') return `Modify order failed: ${d.error || 'unknown error'}`;
    return `Order modified: ${d.coin} ${d.side} ${d.size} @ ${fmtPx(d.price)} (oid: ${d.oid})`;
  },

  twap_result: (d) => {
    if (d.status === 'error') return `TWAP ${d.action} failed: ${d.error || 'unknown error'}`;
    if (d.action === 'create') {
      const idPart = d.twapId != null ? ` (twapId: ${d.twapId})` : '';
      return `TWAP created: ${d.coin} ${d.side} ${d.size} over ${d.minutes}m${idPart}`;
    }
    return `TWAP cancelled: ${d.coin} (twapId: ${d.twapId})`;
  },

  batch_order_result: (d) => {
    const lines = [
      `Batch orders: ${d.coin} ${d.side}`,
      `Requested: ${d.total}, Submitted: ${d.submitted}, Errors: ${d.errors}`,
    ];
    const preview = (d.results || []).slice(0, 10).map((r) => [
      fmtNum(r.size, 4),
      fmtPx(r.price),
      r.status,
      r.oid || r.error || '—',
    ]);
    if (preview.length) {
      lines.push('');
      lines.push(renderTable(['Size', 'Price', 'Status', 'Detail'], preview, [0, 1]));
    }
    return lines.join('\n');
  },

  cancel_result: (d) => d.cancelled ? `Cancelled order ${d.oid}` : `Cancel failed: ${d.error || 'unknown'}`,

  'cancel-all_result': (d) => `Cancelled ${d.count} order(s).`,

  'cancel-multiple_result': (d) => {
    const lines = [
      `Cancelled ${d.cancelled}/${d.requested} requested order(s).`,
    ];
    if (d.skipped?.length) {
      lines.push('Skipped:');
      for (const item of d.skipped.slice(0, 10)) {
        lines.push(`  ${item.oid}: ${item.reason}`);
      }
    }
    return lines.join('\n');
  },

  close_result: (d) => {
    const mode = d.mode || 'market';
    if (mode === 'limit') {
      return `Close position (${mode}): ${d.coin} ${d.side} ${d.size} @ ${fmtPx(d.price)} (${d.order?.status || 'submitted'})`;
    }
    return `Close position (${mode}): ${d.coin} ${d.side} ${d.size} (${d.order?.status || 'submitted'})`;
  },

  reverse_result: (d) => {
    return `Reverse position: ${d.coin} ${d.fromSide} -> ${d.targetSide} (close ${fmtNum(d.closeSize, 4)} + open ${fmtNum(d.openExtraSize, 4)})`;
  },

  scale_result: (d) => {
    const lines = [
      `Scale order: ${d.coin} ${d.side}`,
      `Range: ${fmtPx(d.from)} -> ${fmtPx(d.to)}, Levels: ${d.count}, Total Size: ${fmtNum(d.totalSize, 4)}`,
      `Submitted: ${d.submitted}, Errors: ${d.errors}`,
    ];
    const preview = (d.levels || []).slice(0, 10).map((r) => [
      fmtNum(r.size, 4),
      fmtPx(r.price),
      r.status,
      r.oid || r.error || '—',
    ]);
    if (preview.length) {
      lines.push('');
      lines.push(renderTable(['Size', 'Price', 'Status', 'Detail'], preview, [0, 1]));
    }
    return lines.join('\n');
  },

  tpsl_result: (d) => {
    return `TP/SL attached: ${d.coin} ${d.side} size ${fmtNum(d.size, 4)} (TP ${fmtPx(d.tp)}, SL ${fmtPx(d.sl)})`;
  },

  oto_result: (d) => {
    return `OTO created: ${d.coin} ${d.side} ${fmtNum(d.size, 4)} @ ${fmtPx(d.entryPrice)} (TP ${fmtPx(d.tp)}, SL ${fmtPx(d.sl)})`;
  },

  leverage_result: (d) => `Leverage set: ${d.coin} ${d.leverage}x ${d.mode}`,

  topup_result: (d) => `Topped up ${d.coin} isolated margin by ${fmtUsd(d.usd)}`,

  'approve-builder_result': (d) => `Builder fee approved for ${d.builderAddress}`,
  'builder-approval': (d) => {
    const status = d.approved ? 'approved' : 'not approved';
    const lines = [
      `Builder approval: ${status}`,
      `User: ${d.user}`,
      `Builder: ${d.builderAddress}`,
      `maxBuilderFee: ${d.maxBuilderFee}`,
    ];
    if (d.orderBuilder) {
      lines.push(`Order builder payload: ${JSON.stringify(d.orderBuilder)}`);
    }
    return lines.join('\n');
  },
  transfer_result: (d) => `Transferred ${fmtUsd(d.usd)} from ${d.from} to ${d.to}.`,

  'onchain-ping': (d) => `Onchain ping OK\nPath: ${d.path}`,
  'onchain-health': (d) => `Onchain health OK\nPath: ${d.path}`,
  'onchain-mids': (d) => {
    const mids = normalizeMidsPayload(d.payload);
    const entries = Object.entries(mids).filter(([, mid]) => (
      typeof mid === 'number' || typeof mid === 'string'
    ));
    const preview = entries.slice(0, 10).map(([coin, mid]) => [coin, fmtPx(mid)]);
    if (!preview.length) return 'Onchain mids: empty';
    return `Onchain mids (${entries.length})\n\n` + renderTable(['Coin', 'Mid'], preview, [1]);
  },
  'onchain-spot-meta-deprecated': (d) => d.message,
  'onchain-spot-meta': (d) => {
    const payload = unwrapOnchainPayload(d.payload) || {};
    const universe = Array.isArray(payload.universe) ? payload.universe : firstArray(payload);
    return `Onchain spot meta\nPath: ${d.path}\nAssets: ${universe.length}`;
  },
  'onchain-perps-meta': (d) => {
    const payload = unwrapOnchainPayload(d.payload) || {};
    const dexes = Array.isArray(payload.dexes) ? payload.dexes : firstArray(payload);
    return `Onchain perps meta\nPath: ${d.path}\nDexes/Rows: ${dexes.length}`;
  },
  'onchain-spot-holders': (d) => {
    const rows = firstArray(unwrapOnchainPayload(d.payload)).slice(0, 10);
    if (!rows.length) return 'Onchain spot holders: empty';
    const tableRows = rows.map((r, i) => [
      r.address || r.user || r.wallet || '—',
      r.amount || r.balance || r.holdings || '—',
      deriveRank(r, i, d.query),
    ]);
    return `Onchain spot holders\nPath: ${d.path}\n\n` + renderTable(['Address', 'Amount', 'Rank'], tableRows);
  },
  'onchain-spot-holder-counts': (d) => {
    const rows = firstArray(unwrapOnchainPayload(d.payload)).slice(0, 10);
    if (!rows.length) return 'Onchain spot holder counts: empty';
    const tableRows = rows.map((r) => [
      r.coin || r.symbol || '—',
      r.count || r.holders || '—',
    ]);
    return `Onchain spot holder counts\nPath: ${d.path}\n\n` + renderTable(['Coin', 'Count'], tableRows, [1]);
  },
  'onchain-perp-holders': (d) => {
    const rows = firstArray(unwrapOnchainPayload(d.payload)).slice(0, 10);
    if (!rows.length) return 'Onchain perp holders: empty';
    const tableRows = rows.map((r, i) => [
      r.address || r.user || r.wallet || '—',
      r.size || r.position || r.notional || '—',
      deriveRank(r, i, d.query),
    ]);
    return `Onchain perp holders\nPath: ${d.path}\n\n` + renderTable(['Address', 'Size', 'Rank'], tableRows);
  },
  'onchain-address-tags': (d) => {
    const payload = unwrapOnchainPayload(d.payload);
    const map = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    const entries = Object.entries(map);
    if (!entries.length) return 'Onchain address tags: empty';
    const rows = entries.slice(0, 10).map(([address, tags]) => [
      address,
      Array.isArray(tags) ? tags.join(', ') : String(tags || '—'),
    ]);
    return `Onchain address tags\nPath: ${d.path}\nEntries: ${entries.length}\n\n`
      + renderTable(['Address', 'Tags'], rows);
  },
  'onchain-orders-book': (d) => {
    const normalized = normalizeOrdersPayload(d.payload);
    if (!normalized.orders.length) {
      return `Onchain orders (book)\nPath: ${d.path}\nCoin: ${normalized.coin}\nNo orders.`;
    }
    const rows = normalized.orders.slice(0, 20).map((row) => ([
      row.oid ?? '—',
      row.side ?? '—',
      fmtNum(row.size ?? row.sz ?? row.origSize, 4),
      fmtPx(row.price ?? row.limitPx),
      row.isTrigger ? 'yes' : 'no',
    ]));
    return `Onchain orders (book)\nPath: ${d.path}\nCoin: ${normalized.coin}\nPagination: ${formatPagination(normalized.pagination)}\n\n`
      + renderTable(['OID', 'Side', 'Size', 'Price', 'Trigger'], rows, [2, 3]);
  },
  'onchain-orders-untriggered': (d) => {
    const normalized = normalizeOrdersPayload(d.payload);
    if (!normalized.orders.length) {
      return `Onchain orders (untriggered)\nPath: ${d.path}\nCoin: ${normalized.coin}\nNo orders.`;
    }
    const rows = normalized.orders.slice(0, 20).map((row) => ([
      row.oid ?? '—',
      row.side ?? '—',
      fmtNum(row.size ?? row.sz ?? row.origSize, 4),
      fmtPx(row.price ?? row.limitPx),
      row.triggerPx ?? '—',
    ]));
    return `Onchain orders (untriggered)\nPath: ${d.path}\nCoin: ${normalized.coin}\nPagination: ${formatPagination(normalized.pagination)}\n\n`
      + renderTable(['OID', 'Side', 'Size', 'Price', 'Trigger Px'], rows, [2, 3, 4]);
  },
  'onchain-orders-chart': (d) => {
    const payload = unwrapOnchainPayload(d.payload) || {};
    const heatmap = Array.isArray(payload.heatmap) ? payload.heatmap : [];
    if (!heatmap.length) {
      return `Onchain orders chart\nPath: ${d.path}\nCoin: ${payload.coin || d.query?.coin || '—'}\nNo chart bars.`;
    }
    const rows = heatmap.slice(0, 20).map((r) => ([
      r.priceBinIndex ?? '—',
      fmtPx(r.priceBinStart),
      fmtPx(r.priceBinEnd),
      fmtNum(r.orderValue, 2),
      r.ordersCount ?? '—',
    ]));
    return `Onchain orders chart\nPath: ${d.path}\nCoin: ${payload.coin || d.query?.coin || '—'}\nType: ${payload.type || d.query?.type || 'book'}\nRows: ${heatmap.length}\n\n`
      + renderTable(['Bin', 'Start', 'End', 'Order Value', 'Orders'], rows, [0, 1, 2, 3, 4]);
  },
  'onchain-prediction-positions': (d) => {
    const payload = unwrapOnchainPayload(d.payload) || {};
    const rows = Array.isArray(payload.holders) ? payload.holders : firstArray(payload);
    const title = `Onchain prediction positions\nPath: ${d.path}\nOutcome: ${payload.outcomeId ?? d.query?.outcomeId ?? '—'} ${payload.outcomeName || ''}`.trim();
    if (!rows.length) return `${title}\nNo positions.`;
    const tableRows = rows.slice(0, 20).map((row, idx) => [
      deriveRank(row, idx, d.query),
      row.address || row.user || '—',
      row.sideName || row.side || row.tokenId || '—',
      fmtNum(row.balance, 4),
      fmtNum(row.value, 2),
      fmtNum(row.uPnl, 2),
      fmtPctLiteral(row.roe),
    ]);
    return `${title}\nPagination: ${formatPagination(payload.pagination)}\n\n`
      + renderTable(['Rank', 'Address', 'Side', 'Balance', 'Value', 'uPnL', 'ROE'], tableRows, [0, 3, 4, 5, 6]);
  },
  'onchain-prediction-orders-book': (d) => formatPredictionOrders(d, 'Onchain prediction orders (book)'),
  'onchain-prediction-orders-untriggered': (d) => formatPredictionOrders(d, 'Onchain prediction orders (untriggered)'),
  'onchain-prediction-orders-book-batch': (d) => formatPredictionOrdersBatch(d, 'Onchain prediction orders (book batch)'),
  'onchain-prediction-orders-untriggered-batch': (d) => formatPredictionOrdersBatch(d, 'Onchain prediction orders (untriggered batch)'),
  'onchain-tradfi-volume-top': (d) => formatTradfiTop(d, 'Onchain TradFi volume top'),
  'onchain-tradfi-gainers-top': (d) => formatTradfiTop(d, 'Onchain TradFi gainers top'),
  'onchain-tradfi-gainers-holder-pnl-top': (d) => {
    const payload = unwrapOnchainPayload(d.payload) || {};
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) return `Onchain TradFi gainers holder PnL top\nPath: ${d.path}\nNo assets.`;
    const rows = [];
    for (const item of items.slice(0, 10)) {
      const holders = Array.isArray(item.topPnlHolders) ? item.topPnlHolders : [];
      if (!holders.length) {
        rows.push([item.coin || '—', '—', '—', '—', '—', '—']);
        continue;
      }
      for (const holder of holders.slice(0, 5)) {
        rows.push([
          item.coin || '—',
          holder.address || '—',
          holder.side || '—',
          fmtNum(holder.uPnl, 2),
          fmtPctLiteral(holder.roe),
          holder.liquidationRisk || '—',
        ]);
      }
    }
    return `Onchain TradFi gainers holder PnL top\nPath: ${d.path}\nPeriod: ${payload.period || d.query?.period || '24h'}\n\n`
      + renderTable(['Coin', 'Address', 'Side', 'uPnL', 'ROE', 'Liq Risk'], rows, [3, 4]);
  },
  'onchain-liquidation-map': (d) => {
    const payload = unwrapOnchainPayload(d.payload) || {};
    const heatmap = Array.isArray(payload.heatmap) ? payload.heatmap : firstArray(payload);
    if (heatmap.length) {
      const coin = payload.coin || d.query?.coin || heatmap[0]?.coin || '—';
      const headers = ['Coin', 'Bin', 'Start', 'End', 'Liq Value', 'Positions', 'Segment'];
      const rows = heatmap.map((r, idx) => ([
        r.coin || coin,
        r.priceBinIndex ?? idx,
        fmtPx(r.priceBinStart),
        fmtPx(r.priceBinEnd),
        fmtNum(r.liquidationValue, 2),
        r.positionsCount ?? '—',
        r.mostImpactedSegment ?? '—',
      ]));
      return `Onchain liquidation map\nPath: ${d.path}\nCoin: ${coin}\nRows: ${heatmap.length}\n\n`
        + renderTable(headers, rows, [1, 2, 3, 4, 5, 6]);
    }
    if (payload.url) return `Onchain liquidation map\nPath: ${d.path}\nURL: ${payload.url}`;
    return `Onchain liquidation map\nPath: ${d.path}\n` + JSON.stringify(payload, null, 2);
  },
  'onchain-liqmap-timeline': (d) => {
    const rows = firstArray(unwrapOnchainPayload(d.payload));
    if (!rows.length) return `Onchain liqmap timeline\nPath: ${d.path}\nNo snapshots.`;
    const tableRows = rows.slice(0, 20).map((r) => [
      r.coin || d.query?.coin || '—',
      r.snapshotHeight ?? r.height ?? '—',
      r.recordedAt ? new Date(r.recordedAt).toISOString().slice(0, 19).replace('T', ' ') : '—',
      Array.isArray(r.bins) ? r.bins.length : '—',
    ]);
    return `Onchain liqmap timeline\nPath: ${d.path}\nRows: ${rows.length}\n\n`
      + renderTable(['Coin', 'Snapshot', 'Recorded At', 'Bins'], tableRows, [1, 3]);
  },
  'onchain-trending': (d) => {
    const payload = unwrapOnchainPayload(d.payload) || {};
    const market = d.query?.market || payload.market || 'all';
    if (market === 'spot' || market === 'perp') {
      const items = Array.isArray(payload.items) ? payload.items : [];
      if (!items.length) return `Onchain trending (${market})\nPath: ${d.path}\nNo items.`;
      const rows = items.slice(0, 20).map((item, idx) => [
        idx + 1,
        item.coin || item.symbol || '—',
        fmtPct(item.changePct ?? item.change24h ?? item.priceChangePct ?? 0),
        fmtNum(item.volume ?? item.volume24h ?? item.turnover, 2),
      ]);
      return `Onchain trending (${market})\nPath: ${d.path}\nPeriod: ${payload.period || d.query?.period || '1h'}\nPagination: ${formatPagination(payload.pagination)}\n\n`
        + renderTable(['Rank', 'Coin', 'Change', 'Volume'], rows, [0, 2, 3]);
    }

    const spotItems = Array.isArray(payload.spot?.items) ? payload.spot.items : [];
    const perpItems = Array.isArray(payload.perp?.items) ? payload.perp.items : [];
    const rows = [
      ['spot', spotItems.length, formatPagination(payload.spot?.pagination)],
      ['perp', perpItems.length, formatPagination(payload.perp?.pagination)],
    ];
    return `Onchain trending (all)\nPath: ${d.path}\nPeriod: ${payload.period || d.query?.period || '1h'}\n\n`
      + renderTable(['Market', 'Items', 'Pagination'], rows, [1]);
  },
  'onchain-leaderboard': (d) => {
    const rows = firstArray(unwrapOnchainPayload(d.payload)).slice(0, 10);
    if (!rows.length) return 'Onchain leaderboard: empty';
    const sortField = d.query?.sort || 'pnl_day';
    const valueHeader = sortField === 'accountValue' ? 'Account Value' : sortField;
    const tableRows = rows.map((r, idx) => [
      deriveRank(r, idx, d.query),
      getLeaderboardUser(r),
      getLeaderboardMetric(r, sortField),
    ]);
    return `Onchain leaderboard\nPath: ${d.path}\n\n` + renderTable(['Rank', 'User', valueHeader], tableRows, [0, 2]);
  },
  'onchain-hip3-fills': (d) => {
    const payload = unwrapOnchainPayload(d.payload) || {};
    const items = Array.isArray(payload.items) ? payload.items : firstArray(payload);
    if (!items.length) return 'Onchain HIP-3 fills: empty';
    const rows = items.slice(0, 20).map((item) => ([
      item.blockTime
        ? new Date(item.blockTime).toISOString().slice(0, 19).replace('T', ' ')
        : (item.time ? new Date(item.time).toISOString().slice(0, 19).replace('T', ' ') : '—'),
      item.coin || d.query?.coin || '—',
      item.side || '—',
      fmtNum(item.sz ?? item.size, 4),
      fmtPx(item.px ?? item.price),
      fmtNum(item.notionalUsd ?? item.notional, 2),
    ]));
    return `Onchain HIP-3 fills\nPath: ${d.path}\nPagination: ${formatPagination(payload.pagination)}\n\n`
      + renderTable(['Time', 'Coin', 'Side', 'Size', 'Price', 'Notional'], rows, [3, 4, 5]);
  },
  'onchain-hip3-smart-trader': (d) => formatSmartTrader(d, 'Onchain HIP-3 smart traders', 'Coin'),
  'onchain-hip4-smart-trader': (d) => formatSmartTrader(d, 'Onchain HIP-4 smart traders', 'Token ID'),
};

// --- Main format function ---

export function formatResult(result, mode = 'text') {
  if (!result) return 'No result.';

  if (result instanceof SkillError || result instanceof Error) {
    return `Error [${result.code || 'UNKNOWN'}]: ${result.message}`;
  }

  if (mode === 'json') {
    return JSON.stringify(result, null, 2);
  }

  if (!result.ok) {
    const msg = result.error || result.data?.message || 'Unknown error';
    return `Error: ${msg}`;
  }

  const formatter = formatters[result.type];
  if (formatter) {
    let output = formatter(result.data);
    if (result.notices?.length) {
      output += '\n\nReminder:\n' + result.notices.map(n => `  - ${n}`).join('\n');
    }
    if (result.warnings?.length) {
      output += '\n\nWarnings:\n' + result.warnings.map(w => `  ⚠ ${w}`).join('\n');
    }
    return output;
  }

  // Fallback
  return JSON.stringify(result.data, null, 2);
}
