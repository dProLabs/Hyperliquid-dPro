---
name: dpro-hl
description: Use this skill for spot, perpetual, and HIP-3 asset trading and data queries on Hyperliquid; supports order placement/cancellation, leverage and margin management, real-time positions/PnL/orderbook/market monitoring, multi-account workflows, and onchain read-only data such as holder distribution, liquidation heatmaps, and leaderboards.
---

# Hyperliquid-dPro API Skill

Trade spot, perpetuals, and HIP-3 traditional assets (stocks, indexes, commodities) on Hyperliquid DEX from the command line, with integrated market/account reads and onchain data queries.

## Skill Routing

Use this skill for:
- Hyperliquid market reads (`quote`, `book`, `candles`, `movers`, `overview`, `markets ls`)
- Hyperliquid account reads (`positions`, `balances`, `orders`, `fills`, `portfolio`)
- Hyperliquid trade writes across three equal modules: spot, perps, and HIP-3 (`order limit/market/cancel/...`, `set-leverage`, `topup-isolated`, `approve-builder`)
- Onchain data read commands under `dpro-hl onchain ...`

Do not use this skill for:
- General programming tutorials unrelated to this repository
- Non-Hyperliquid exchange operations

## Developer Quickstart

```bash
node --input-type=module -e "
  import { runHyperliquidSkill } from './scripts/entry.mjs';
  console.log(await runHyperliquidSkill('dpro-hl quote BTC'));
"
```

## Execution Model (Important)

- Treat any `dpro-hl ...` string as **skill input text**, not a shell executable.
- Never run `dpro-hl` directly in terminal commands.
- For execution/checks inside the agent runtime, always call:
  - `runHyperliquidSkill('<dpro-hl command>', runtimeContext)`
- Command examples in this document describe input syntax, not PATH binaries.

Runtime parameters:
- `runtimeContext.password`: required for API account decryption and write actions
- Onchain API uses fixed base URL: `https://api.d.pro/`

## Set Up API Key for Trading

To execute trades, you need a Hyperliquid API wallet:

1. Connect wallet and sign in to Hyperliquid: `https://app.hyperliquid.xyz/join/DPRO1`
2. Open `https://app.hyperliquid.xyz/API`
3. Create an API wallet
4. Copy the API wallet private key (`0x...`)
5. Add account in skill:

```bash
dpro-hl account add-api <masterAddress> <agentPrivateKey> [alias]
```

Quick validation:

```bash
dpro-hl account ls
dpro-hl positions <alias>
```

## Command Surface (Core)

### Market
```bash
dpro-hl quote BTC
dpro-hl book ETH --levels 10
dpro-hl candles SOL --interval 1h --last 20
dpro-hl markets ls
```

### Account
```bash
dpro-hl account ls
dpro-hl account add-readonly <address> [alias]
dpro-hl positions [alias|address]
```

### Trade
```bash
# Spot example (coin from markets list)
dpro-hl order limit buy 10 PURR 0.08

# Perps example
dpro-hl order limit buy 0.01 BTC 50000
dpro-hl order market sell 0.01 ETH --slippage 0.5

# HIP-3 example
dpro-hl order limit buy 1 xyz:NVDA 120
dpro-hl order cancel <oid>
```

### HIP-3 Trading Demos
```bash
# Always discover exact coin values first (strict match)
dpro-hl markets ls

# Example HIP-3 orders (use exact coin from markets list)
dpro-hl order limit buy 1 xyz:NVDA 120
dpro-hl order market sell 1 xyz:NVDA --slippage 0.5
dpro-hl order cancel-by-cloid xyz:NVDA <cloid>

# Perps/HIP-3-perps risk controls (not spot)
dpro-hl order set-leverage xyz:NVDA 5 --cross
dpro-hl order topup-isolated xyz:NVDA 50
```

### Onchain
```bash
dpro-hl onchain health
dpro-hl onchain mids
dpro-hl onchain spot-holders PURR --limit 5
dpro-hl onchain perp-holders BTC --limit 5 --order desc
dpro-hl onchain leaderboard --limit 10
```

## Operation Flow

### Step 1: Identify Intent Domain
- Market read -> `market` commands
- Account management/read -> `account` or account shortcuts
- Trade write -> `order ...` or `approve-builder` (spot, perps, and HIP-3)
- External onchain API read -> `onchain ...`

### Step 2: Collect Required Parameters
- Missing `coin` -> ask for exact symbol from `dpro-hl markets ls` (spot/perps/HIP-3 all require exact match)
- Missing account context for reads -> use default account or explicit alias/address
- For any trade write (`order ...`, `set-leverage`, `topup-isolated`, `approve-builder`), run preflight checks in order:
  - 1) Check accounts first: run `dpro-hl account ls`
  - 2) If no API account exists: prompt API wallet setup (`add-api`)
  - 3) If an API account already exists: do not ask user to re-bind account; only require password
- Missing password for writes -> require `runtimeContext.password` or `--password`

### Step 3: Execute
- Parse input (command/slash/NL), route by domain/action, run command handler, format output
- Use `--json` for raw structured output when needed

### Step 4: Suggest Next Actions
- After market read: suggest `book`, `candles`, or `markets ls`
- After account read: suggest `positions`, `balances`, or `orders`
- After trade write: suggest `orders`, `cancel`, or risk checks (`set-leverage` review)
- After onchain read: suggest relevant neighboring onchain command (`mids` -> `perp-holders`, `leaderboard`, etc.)

## Critical Rules

- Symbol matching is strict and exact.
  - `AAPL` and `xyz:AAPL` are different assets.
- Treat spot, perps, and HIP-3 as parallel trading modules; do not auto-downgrade HIP-3 requests to spot/perps symbols.
- Onchain namespaced perp coin normalization uses:
  - dex lowercase + asset uppercase (example: `XYZ:nvda` -> `xyz:NVDA`)
- Leverage and isolated top-up apply to perps (including HIP-3 perps) only.
- Market orders are executed as IOC limit orders with slippage protection.

## Security & Secrets

- Never print private keys or master password values.
- Require API account mode for write actions.
- Keep read-only and write flows separated by account mode.
- For trade writes, do not proceed without password; prompt user for password input first.

## Prompting for API Keys

Only use this section when `dpro-hl account ls` confirms there is no API account configured.

When user has no API account configured:

1. Recommend referral onboarding link:
   - `https://app.hyperliquid.xyz/join/DPRO1`
2. Ask user to create API wallet at `https://app.hyperliquid.xyz/API`
3. Ask user to run:
   - `dpro-hl account add-api <masterAddress> <agentPrivateKey> [alias]`
4. Remind security rules:
   - do not paste private keys into chat logs
   - pass password through runtime context or `--password`

If user already has an API account:
- do not suggest `add-api` again
- ask for password only, then continue the requested trade command

Example prompt to user:

> To trade on Hyperliquid, you need an API wallet. Here is the setup flow:
>
> 1. Connect wallet and sign in to Hyperliquid: https://app.hyperliquid.xyz/join/DPRO1
> 2. Go to https://app.hyperliquid.xyz/API
> 3. Click \"Create API Wallet\" (name it as you like)
> 4. Copy the private key (starts with `0x`)
> 5. Run `dpro-hl account add-api <masterAddress> <agentPrivateKey> [alias]`
>
> If you want, I can guide you step by step.

## References

- Hyperliquid-dPro Skill Reference: [`references/commands.md`](references/commands.md)
- Onchain API Reference: [`references/onchain.md`](references/onchain.md)
- Troubleshooting Reference: [`references/troubleshooting.md`](references/troubleshooting.md)
- Workflow Examples: [`examples.md`](examples.md)
