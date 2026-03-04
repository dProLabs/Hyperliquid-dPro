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

  'account-ls': (d) => {
    if (!d.accounts.length) {
      const table = renderTable(['Alias', 'Address', 'Mode', 'Default'], []);
      const hint = [
        'No accounts configured.',
        'Next steps:',
        '1. Connect wallet and sign in to Hyperliquid: https://app.hyperliquid.xyz/join/DPRO1',
        '2. Create an API wallet at https://app.hyperliquid.xyz/API',
        '3. Run: hl account add-api <masterAddress> <agentPrivKey> [alias]',
        '4. Optional read-only mode: hl account add-readonly <address> [alias]',
      ].join('\n');
      return `Accounts (0)\n\n${table}\n\n${hint}`;
    }
    const headers = ['Alias', 'Address', 'Mode', 'Default'];
    const rows = d.accounts.map(a => [a.alias, a.masterAddress.slice(0, 10) + '...', a.mode, a.isDefault ? '*' : '']);
    return `Accounts (${d.accounts.length})\n\n` + renderTable(headers, rows);
  },

  'account-added': (d) => `Account "${d.alias}" added (${d.mode}, ${d.masterAddress.slice(0, 10)}...)`,
  'account-removed': (d) => `Account "${d.alias}" removed.`,
  'account-default-set': (d) => `Default account set to "${d.alias}".`,

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

  order_result: (d) => {
    if (d.status === 'filled') return `Order filled: ${d.coin} ${d.side} ${d.size} @ ${fmtPx(d.price)}`;
    if (d.status === 'resting') return `Order resting: ${d.coin} ${d.side} ${d.size} @ ${fmtPx(d.price)} (oid: ${d.oid})`;
    if (d.status === 'error') return `Order error: ${d.error}`;
    return `Order status: ${d.status}`;
  },

  cancel_result: (d) => d.cancelled ? `Cancelled order ${d.oid}` : `Cancel failed: ${d.error || 'unknown'}`,

  'cancel-all_result': (d) => `Cancelled ${d.count} order(s).`,

  leverage_result: (d) => `Leverage set: ${d.coin} ${d.leverage}x ${d.mode}`,

  topup_result: (d) => `Topped up ${d.coin} isolated margin by ${fmtUsd(d.usd)}`,

  'approve-builder_result': (d) => `Builder fee approved for ${d.builderAddress}`,

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
    if (result.warnings?.length) {
      output += '\n\nWarnings:\n' + result.warnings.map(w => `  ⚠ ${w}`).join('\n');
    }
    return output;
  }

  // Fallback
  return JSON.stringify(result.data, null, 2);
}
