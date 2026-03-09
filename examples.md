# Hyperliquid-dPro Examples

Workflow examples for common spot/perps/HIP-3 and onchain scenarios.

## Initial Setup

### Add Your First Account

```bash
# Read-only account (monitoring)
dpro-hl account add-readonly 0xYourAddress main-ro

# API account (trading)
dpro-hl account add-api 0xYourMasterAddress 0xYourAgentPrivateKey main

# Verify
dpro-hl account ls
```

### Verify Runtime Inputs

```bash
# For write commands, pass password
node --input-type=module -e "
  import { runHyperliquidSkill } from './scripts/entry.mjs';
  console.log(await runHyperliquidSkill('dpro-hl positions main', { password: '***' }));
"

# For onchain commands, set base URL
export ONCHAIN_API_BASE_URL=https://api.d.pro/
```

---

## Symbol Discovery First

Always resolve exact symbols before trading.

```bash
dpro-hl markets ls
```

Use `coin` exactly as listed. `AAPL` and `xyz:AAPL` are different symbols.

---

## Trading Spot Assets

```bash
# Quote and book
dpro-hl quote PURR
dpro-hl book PURR --levels 10

# Spot limit/market
dpro-hl order limit buy 10 PURR 0.08
dpro-hl order market sell 5 PURR --slippage 0.5

# Check orders/fills
dpro-hl orders main
dpro-hl fills main --limit 20
```

---

## Trading Crypto Perps

```bash
# Perp quote and candles
dpro-hl quote BTC
dpro-hl candles BTC --interval 1h --last 24

# Perp risk config
dpro-hl order set-leverage BTC 10 --cross
dpro-hl order topup-isolated BTC 50

# Perp orders
dpro-hl order limit buy 0.01 BTC 50000
dpro-hl order market sell 0.01 BTC --slippage 0.5

# Cancel flow
dpro-hl orders main
dpro-hl order cancel <oid>
```

---

## Trading HIP-3 Assets

```bash
# Use exact namespaced symbol from markets list
dpro-hl markets ls

# HIP-3 quote and book
dpro-hl quote xyz:NVDA
dpro-hl book xyz:NVDA --levels 5

# HIP-3 orders
dpro-hl order limit buy 1 xyz:NVDA 120
dpro-hl order market sell 1 xyz:NVDA --slippage 0.5

# HIP-3 cancel by cloid
dpro-hl order cancel-by-cloid xyz:NVDA <cloid>

# HIP-3 perp risk controls
dpro-hl order set-leverage xyz:NVDA 5 --cross
dpro-hl order topup-isolated xyz:NVDA 50
```

---

## Multi-Account Operations

```bash
# List and switch default account
dpro-hl account ls
dpro-hl account set-default main

# Query by alias/address
dpro-hl positions main
dpro-hl balances main
dpro-hl portfolio main
```

---

## Onchain Read Workflows

```bash
# Health and mids
dpro-hl onchain health
dpro-hl onchain mids

# Holders and leaderboard
dpro-hl onchain spot-holders PURR --limit 5
dpro-hl onchain perp-holders xyz:nvda --limit 5 --order desc
dpro-hl onchain leaderboard --limit 10 --sort pnl_day --order desc

# Liquidation heatmap
dpro-hl onchain liquidation-map xyz:TSLA
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
dpro-hl markets ls

# Missing API password -> pass runtimeContext.password or --password

# Missing onchain base URL
export ONCHAIN_API_BASE_URL=https://api.d.pro/
```
