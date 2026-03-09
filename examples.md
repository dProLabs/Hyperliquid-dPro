# Hyperliquid-dPro Examples

Task-oriented workflow examples for common Hyperliquid and dPro use cases.

This file is a **cookbook**, not a full command reference.

Use the other docs for their intended purposes:

- `README.md` for installation, runtime model, configuration, and high-level usage
- `SKILL.md` for routing, execution policy, and safety rules
- `references/commands.md` for canonical command syntax
- `references/onchain.md` for onchain endpoint behavior and normalization
- `references/troubleshooting.md` for diagnosis and fixes

---

## How to use this file

Follow these examples when you already know the task you want to complete.

Typical pattern:

1. identify the market or account context
2. resolve the exact symbol if trading is involved
3. inspect price, balance, or position state
4. perform the action
5. verify the result

---

## Example 1: First-time account setup and readiness check

Goal: add a monitoring account, add a trading account, and verify the runtime is ready.

### 1. Add a read-only account

```bash
# Monitoring only
 dpro-hl account add-readonly 0xYourAddress main-ro
```

### 2. Add an API account

```bash
# Trading account
 dpro-hl account add-api 0xYourMasterAddress 0xYourAgentPrivateKey main password
```

### 3. Verify configured accounts

```bash
 dpro-hl account ls
```

### 4. Verify runtime invocation

```bash
node --input-type=module -e "
  import { runHyperliquidSkill } from './scripts/entry.mjs';
  console.log(await runHyperliquidSkill('dpro-hl positions main', { password: '***' }));
"
```

Expected outcome:
- the account list shows your aliases and modes
- the runtime can resolve the requested account
- write-capable flows can decrypt the stored API key when password is supplied

---

## Example 2: Discover the exact tradable symbol before trading

Goal: resolve the exact symbol and market namespace before placing an order.

### 1. List markets

```bash
 dpro-hl markets ls
```

### 2. Use the exact symbol from the output

Examples:
- `PURR` for spot
- `BTC` for perp when used with the `perp` namespace
- `xyz:NVDA` for HIP-3

Important:
- `AAPL` and `xyz:AAPL` are different assets
- do not trade from a guessed symbol when the market type is unclear

---

## Example 3: Spot trading workflow

Goal: buy a spot asset, then confirm the order and fills.

### 1. Inspect market data

```bash
 dpro-hl quote PURR
 dpro-hl book PURR --levels 10
```

### 2. Place a spot limit order

```bash
 dpro-hl spot order limit buy 10 PURR 0.08
```

### 3. Or place a spot market order with bounded slippage

```bash
 dpro-hl spot order market sell 5 PURR --slippage 0.5
```

### 4. Verify result

```bash
 dpro-hl orders main
 dpro-hl fills main --limit 20
```

Expected outcome:
- the order appears in open orders or recent fills
- the fill report reflects the executed quantity and price

---

## Example 4: Perp trading workflow

Goal: configure risk, place a perp order, and confirm the resulting state.

### 1. Inspect market state

```bash
 dpro-hl quote BTC
 dpro-hl candles BTC --interval 1h --last 24
```

### 2. Set leverage or top up isolated margin

```bash
 dpro-hl perp order set-leverage BTC 10 --cross
 dpro-hl perp order topup-isolated BTC 50
```

### 3. Place a perp order

```bash
 dpro-hl perp order limit buy 0.01 BTC 50000
 dpro-hl perp order market sell 0.01 BTC --slippage 0.5
```

### 4. Check the resulting state

```bash
 dpro-hl orders main
 dpro-hl positions main
 dpro-hl fills main --limit 20
```

### 5. Cancel if needed

```bash
 dpro-hl perp order cancel <oid>
```

Expected outcome:
- leverage mode is updated before the order if requested
- the order is visible in orders or fills
- positions reflect the new exposure after execution

---

## Example 5: HIP-3 trading workflow

Goal: trade a HIP-3 asset using its exact namespaced symbol.

### 1. Resolve the symbol first

```bash
 dpro-hl markets ls
```

### 2. Inspect market data

```bash
 dpro-hl quote xyz:NVDA
 dpro-hl book xyz:NVDA --levels 5
```

### 3. Place a HIP-3 order

```bash
 dpro-hl hip3 order limit buy 1 xyz:NVDA 120
 dpro-hl hip3 order market sell 1 xyz:NVDA --slippage 0.5
```

### 4. Cancel by cloid when needed

```bash
 dpro-hl hip3 order cancel-by-cloid xyz:NVDA <cloid>
```

### 5. Apply HIP-3 perp-style risk controls when supported

```bash
 dpro-hl hip3 order set-leverage xyz:NVDA 5 --cross
 dpro-hl hip3 order topup-isolated xyz:NVDA 50
```

Expected outcome:
- the command stays within the HIP-3 namespace
- the symbol is not silently remapped into spot or non-HIP-3 perp markets

---

## Example 6: Multi-account workflow

Goal: inspect and operate on a specific account safely.

### 1. List accounts and set the default

```bash
 dpro-hl account ls
 dpro-hl account set-default main
```

### 2. Query the selected account explicitly

```bash
 dpro-hl positions main
 dpro-hl balances main
 dpro-hl portfolio main
```

Recommended practice:
- use explicit aliases for writes when more than one trading account exists
- do not rely on implicit default selection if account scope matters

---

## Example 7: Onchain analytics workflow

Goal: inspect dPro onchain data without account authentication.

### 1. Check service status and mids

```bash
 dpro-hl onchain health
 dpro-hl onchain mids
```

### 2. Inspect holder distribution

```bash
 dpro-hl onchain spot-holders PURR --limit 5
 dpro-hl onchain perp-holders xyz:nvda --limit 5 --order desc
```

### 3. Inspect leaderboard and liquidation data

```bash
 dpro-hl onchain leaderboard --limit 10 --sort pnl_day --order desc
 dpro-hl onchain liquidation-map xyz:TSLA
```

Notes:
- namespaced perp coin queries normalize to `dex` lowercase + asset uppercase
- use `--json` when raw payload is needed for downstream automation

---

## Example 8: Natural-language to canonical command

Goal: understand how user intent maps into the canonical command model.

Examples:

- “Show me the latest BTC price”
  -> `dpro-hl quote BTC`

- “Buy 10 PURR spot at 0.08”
  -> `dpro-hl spot order limit buy 10 PURR 0.08`

- “Sell 0.01 BTC perp at market with 0.5 slippage”
  -> `dpro-hl perp order market sell 0.01 BTC --slippage 0.5`

- “Buy 1 share of NVDA at 120 on HIP-3”
  -> `dpro-hl hip3 order limit buy 1 xyz:NVDA 120`

- “Show me the top 5 PURR holders”
  -> `dpro-hl onchain spot-holders PURR --limit 5`

---

## Example 9: Safe trading checklist

Use this checklist before any live write:

1. resolve the exact market namespace: `spot`, `perp`, or `hip3`
2. resolve the exact symbol from `dpro-hl markets ls`
3. verify the target account and password availability
4. inspect quote, book, balance, or position state when relevant
5. place the order or perform the account action
6. verify via `orders`, `fills`, or `positions`
7. do not blind-retry an uncertain write result

---

## Example 10: When to leave this file and use another reference

Use:
- `README.md` when you need install steps, storage layout, runtime context, or project structure
- `references/commands.md` when you need exact flags or full command syntax
- `references/onchain.md` when you need endpoint mapping or response-shape behavior
- `references/troubleshooting.md` when a command fails and you need the direct fix

This file should stay focused on end-to-end workflows, not exhaustive command documentation.
