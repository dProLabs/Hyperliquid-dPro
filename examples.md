# Hyperliquid-dPro Examples

Workflow examples for common spot/perps/HIP-3 and onchain scenarios.

## Initial Setup

### Add Your First Account

```bash
# Read-only account (monitoring)
hl account add-readonly 0xYourAddress main-ro

# API account (trading)
hl account add-api 0xYourMasterAddress 0xYourAgentPrivateKey main

# Verify
hl account ls
```

### Verify Runtime Inputs

```bash
# For write commands, pass password
node --input-type=module -e "
  import { runHyperliquidSkill } from './scripts/entry.mjs';
  console.log(await runHyperliquidSkill('hl positions main', { password: '***' }));
"

# For onchain commands, set base URL
export ONCHAIN_API_BASE_URL=https://api.d.pro/
```

---

## Symbol Discovery First

Always resolve exact symbols before trading.

```bash
hl markets ls
```

Use `coin` exactly as listed. `AAPL` and `xyz:AAPL` are different symbols.

---

## Trading Spot Assets

```bash
# Quote and book
hl quote PURR
hl book PURR --levels 10

# Spot limit/market
hl order limit buy 10 PURR 0.08
hl order market sell 5 PURR --slippage 0.5

# Check orders/fills
hl orders main
hl fills main --limit 20
```

---

## Trading Crypto Perps

```bash
# Perp quote and candles
hl quote BTC
hl candles BTC --interval 1h --last 24

# Perp risk config
hl order set-leverage BTC 10 --cross
hl order topup-isolated BTC 50

# Perp orders
hl order limit buy 0.01 BTC 50000
hl order market sell 0.01 BTC --slippage 0.5

# Cancel flow
hl orders main
hl order cancel <oid>
```

---

## Trading HIP-3 Assets

```bash
# Use exact namespaced symbol from markets list
hl markets ls

# HIP-3 quote and book
hl quote xyz:NVDA
hl book xyz:NVDA --levels 5

# HIP-3 orders
hl order limit buy 1 xyz:NVDA 120
hl order market sell 1 xyz:NVDA --slippage 0.5

# HIP-3 cancel by cloid
hl order cancel-by-cloid xyz:NVDA <cloid>

# HIP-3 perp risk controls
hl order set-leverage xyz:NVDA 5 --cross
hl order topup-isolated xyz:NVDA 50
```

---

## Multi-Account Operations

```bash
# List and switch default account
hl account ls
hl account set-default main

# Query by alias/address
hl positions main
hl balances main
hl portfolio main
```

---

## Onchain Read Workflows

```bash
# Health and mids
hl onchain health
hl onchain mids

# Holders and leaderboard
hl onchain spot-holders PURR --limit 5
hl onchain perp-holders xyz:nvda --limit 5 --order desc
hl onchain leaderboard --limit 10 --sort pnl_day --order desc

# Liquidation heatmap
hl onchain liquidation-map xyz:TSLA
```

Notes:
- On namespaced perp coins, onchain query normalizes to `dex` lowercase + asset uppercase.
- Use `--json` when you need raw payload.

---

## Natural Language Paths

```bash
buy 0.1 BTC
short 0.1 ETH
```

---

## Troubleshooting Shortcuts

```bash
# Symbol errors
hl markets ls

# Missing API password -> pass runtimeContext.password or --password

# Missing onchain base URL
export ONCHAIN_API_BASE_URL=https://api.d.pro/
```
