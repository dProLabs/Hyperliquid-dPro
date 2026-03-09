# Hyperliquid-dPro

An agent skill for [Hyperliquid DEX](https://hyperliquid.xyz) — market queries, account management, spot/perps/HIP-3 trading, and onchain analytics inside AI agent environments (OpenClaw / Claude Code / Codex / OpenCode).

No global CLI install required. Supports 200+ perpetual contracts, spot tokens, and namespaced HIP-3 assets.

## Installation

### Via Clawhub (Recommended)

[Clawhub](https://openclaw.ai) is a skill registry and package manager for AI agent environments.

```bash
# Install the Hyperliquid skill from GitHub
clawhub install github:dProLabs/Hyperliquid-dPro
```

That's it. The skill is now available in your agent environment. Clawhub handles dependency resolution, version management, and skill registration automatically.

Optional manual update (auto-upgrade is already enabled by default for git-clone installs):

```bash
clawhub update github:dProLabs/Hyperliquid-dPro
```

To uninstall:

```bash
clawhub uninstall dpro-hl
```

### For Claude Code

Use the included plugin manifests:

```bash
# In Claude Code
/plugin marketplace add dProLabs/Hyperliquid-dPro
/plugin install dpro-hl
```

Or install manually:

```bash
# Clone into your project's skills directory
git clone https://github.com/dProLabs/Hyperliquid-dPro.git .claude/skills/dpro-hl

# Install dependencies
cd .claude/skills/dpro-hl
npm install
```

Then in your `CLAUDE.md` or agent config, reference the skill:

```markdown
Skills: .claude/skills/dpro-hl/SKILL.md
```

Claude plugin files:
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

### For Cursor

Use the Cursor plugin manifest in:

- `.cursor-plugin/plugin.json`

### For Codex

Follow:

- `.codex/INSTALL.md`

### For OpenCode

Follow:

- `.opencode/INSTALL.md`

### For Other Agent Environments

Copy the skill folder into your agent's skill directory and ensure Node.js is available at runtime.

### Manual / Standalone

```bash
git clone https://github.com/dProLabs/Hyperliquid-dPro.git
cd Hyperliquid-dPro
npm install
```

---

## Usage

### Inside an Agent

Once installed, simply talk to your agent using natural language or command syntax:

```
dpro-hl quote BTC
dpro-hl book ETH --levels 5
dpro-hl markets ls
dpro-hl positions
dpro-hl order limit buy 0.01 BTC 50000
```

The agent will invoke the skill automatically based on `SKILL.md`.

### Programmatic

```js
import { runHyperliquidSkill } from './scripts/entry.mjs';

// Read-only (no account needed)
const result = await runHyperliquidSkill('dpro-hl quote BTC');
console.log(result);

// Trading (password required to decrypt private key)
const result = await runHyperliquidSkill(
  'dpro-hl order limit buy 0.01 BTC 50000',
  { password: 'yourMasterPassword' }
);
```

Runtime context:
- `password`: required for API account decryption and all write actions
- `network`: `mainnet` (default) or `testnet`
- `autoUpgrade`: `boolean` (default `true`) enable or disable in-skill auto-upgrade checks
- `autoUpgradeTimeoutMs`: `number` (default `2000`) timeout budget for each auto-upgrade pass
- `autoUpgradeProvider`: `'auto' | 'git' | 'clawhub' | 'off'` (default `auto`) select upgrade provider
- `autoUpgradeCheckIntervalMs`: `number` (default `900000`) clawhub update check interval
- `autoUpgradeClawhubCmd`: `string` (default `clawhub`) clawhub command alias
- `autoUpgradeDryRun`: `boolean` (default `false`) check-only mode for debugging
- `autoUpgradeDisableNpmInstall`: `boolean` (default `false`) skip `npm install` after successful pull

Auto-upgrade env switches:
- `DPRO_HL_AUTO_UPGRADE=0` disable auto-upgrade globally
- `DPRO_HL_AUTO_UPGRADE_TIMEOUT_MS=2000` override timeout budget
- `DPRO_HL_AUTO_UPGRADE_PROVIDER=auto|git|clawhub|off` force provider routing
- `DPRO_HL_AUTO_UPGRADE_CHECK_INTERVAL_MS=900000` set clawhub update check interval
- `DPRO_HL_AUTO_UPGRADE_CLAWHUB_CMD=clawhub` set clawhub command alias
- `DPRO_HL_AUTO_UPGRADE_DISABLE_NPM=1` skip dependency install step

Auto-upgrade behavior:
- Runs on each `runHyperliquidSkill(...)` invocation
- `git` installs use `git pull --ff-only` + `npm install --silent` when remote is ahead
- `clawhub` installs run `clawhub update <skill-slug>` on the configured check interval
- Never blocks the requested command; failures/timeouts surface as one warning line

### Command Line

```bash
node --input-type=module -e "
  import { runHyperliquidSkill } from './scripts/entry.mjs';
  console.log(await runHyperliquidSkill('dpro-hl quote BTC'));
"
```

---

## Features

- **Multi-Account Management** — store and manage multiple trading accounts with encrypted key storage
- **Market Data** — real-time quotes, order books, candlesticks, top movers, market overview, market listing
- **Trading Modules** — spot, perps, and HIP-3 commands with exact-symbol routing
- **Order Operations** — limit/market, cancel/cancel-all/cancel-by-cloid, builder approval
- **Risk Controls** — leverage updates and isolated margin top-up (perps/HIP-3-perps only)
- **Onchain Reads** — mids, metadata, holder distribution, liquidation map, leaderboard
- **Multi-Input** — command style (`dpro-hl quote BTC`), slash style (`/dpro-hl quote BTC`), or natural language
- **Secure Key Storage** — private keys are AES-encrypted at rest, never stored in plain text
- **Zero Global Install** — runs as a skill inside agent environments, no `npm install -g` needed

---

## Account Management

Accounts are stored encrypted at `~/.config/dpro-hl/`.

### Add Account

**Trading account** (requires API wallet from Hyperliquid):

```bash
dpro-hl account add-api <masterAddress> <agentPrivateKey> [alias]

# Example
dpro-hl account add-api 0xYourMasterAddress 0xYourAgentPrivateKey myaccount
```

To get an API wallet:
1. Sign in via **https://app.hyperliquid.xyz/join/DPRO1**
2. Go to **https://app.hyperliquid.xyz/API**
3. Click **"Create API Wallet"**
4. Copy the **private key** and note your **master wallet address**

Quick validation:

```bash
dpro-hl account ls
dpro-hl positions <alias>
```

**Read-only account** (monitoring only, no private key needed):

```bash
dpro-hl account add-readonly <address> [alias]
```

### Account Commands

```bash
dpro-hl account ls
dpro-hl account add-readonly <address> [alias]
dpro-hl account add-api <masterAddress> <agentPrivateKey> [alias]
dpro-hl account set-default <alias>
dpro-hl account remove <alias>
dpro-hl positions [alias|address]
dpro-hl balances [alias|address]
dpro-hl orders [alias|address]
dpro-hl fills [alias|address] --limit 50
dpro-hl portfolio [alias|address]
```

Shows all configured accounts with alias, address, mode, and default status.

---

## Market Information

View market data without authentication.

### Get Quote

```bash
dpro-hl quote BTC
dpro-hl quote xyz:NVDA
```

Shows price, 24h change, funding rate, open interest, mark/oracle, and 24h volume when available.

### Get Order Book

```bash
dpro-hl book ETH
dpro-hl book ETH --levels 20
```

### Get Candlesticks

```bash
dpro-hl candles BTC --interval 1h --last 48
```

Valid intervals: `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `8h`, `12h`, `1d`, `3d`, `1w`, `1M`

### List All Markets

```bash
dpro-hl markets ls
```

Shows spot, perp, and namespaced markets with type and asset ID.

### Top Movers and Overview

```bash
dpro-hl movers --top 10
dpro-hl movers --side gainers
dpro-hl movers --side losers
dpro-hl overview --top 10
```

---

## Trading

API account with private key required.

### Place Limit Order

```bash
dpro-hl order limit buy  0.001 BTC 50000
dpro-hl order limit sell 0.1 ETH 3500 --tif Gtc
dpro-hl order limit buy  1 xyz:NVDA 120
dpro-hl order limit buy  1 SOL 100 --reduce-only
```

| Option | Description |
|--------|-------------|
| `--tif <tif>` | Time-in-force: `Gtc` (default), `Ioc`, `Alo` |
| `--reduce-only` | Reduce-only order |

### Place Market Order

```bash
dpro-hl order market buy  0.001 BTC
dpro-hl order market sell 0.1 ETH --slippage 0.5
dpro-hl order market sell 1 xyz:NVDA --slippage 0.3
```

Market orders are executed as IOC limit orders with slippage protection.

| Option | Description |
|--------|-------------|
| `--slippage <pct>` | Slippage percentage (default: 0.5%) |
| `--reduce-only` | Reduce-only order |

### Cancel and Builder Actions

```bash
# Cancel specific order
dpro-hl order cancel <oid>

# Cancel all open orders
dpro-hl order cancel-all

# Cancel with cloid
dpro-hl order cancel-by-cloid xyz:NVDA <cloid>

# Approve builder fee
dpro-hl approve-builder
```

### Perp/HIP-3 Perp Risk Controls

```bash
# Cross margin (default)
dpro-hl order set-leverage BTC 10
dpro-hl order set-leverage xyz:NVDA 5 --cross

# Isolated margin
dpro-hl order set-leverage BTC 10 --isolated
dpro-hl order topup-isolated BTC 100
dpro-hl order topup-isolated xyz:NVDA 50
```

Note: leverage and isolated top-up are not supported on spot markets.

---

## Onchain Reads

Onchain read commands are available under `dpro-hl onchain ...`.

```bash
dpro-hl onchain health
dpro-hl onchain mids
dpro-hl onchain spot-meta
dpro-hl onchain perps-meta
dpro-hl onchain spot-holders PURR --limit 5
dpro-hl onchain spot-holder-counts
dpro-hl onchain perp-holders BTC --limit 5 --order desc
dpro-hl onchain liquidation-map xyz:TSLA
dpro-hl onchain leaderboard --limit 10 --sort pnl_day --order desc
```

Notes:
- On namespaced perp coins, normalization is `dex` lowercase + symbol uppercase (example: `XYZ:nvda` -> `xyz:NVDA`).
- Onchain base URL is fixed in runtime: `https://api.d.pro/`.

---

## Global Flags

| Flag | Description |
|--------|-------------|
| `--json` | Output raw JSON instead of formatted text |
| `--account <alias>` | Use a specific account for this command |
| `--password <value>` | Provide master password inline for write actions |

---

## Input Styles

Three equivalent ways to invoke:

```bash
dpro-hl quote BTC                       # Command style
/dpro-hl quote BTC                      # Slash style (in agent chat)
BTC price                          # English natural language
SOL 1h candles last 48             # Candles
buy 0.1 BTC                        # Natural language trading
short 0.1 ETH                      # Natural language trading
```

---

## Examples

### Quick Market and Onchain Check

```bash
# Check BTC price and funding
dpro-hl quote BTC

# See top movers
dpro-hl movers --top 5

# Check order book depth
dpro-hl book ETH --levels 10

# Check onchain mids
dpro-hl onchain mids
```

### Trading Workflow

```bash
# 1. Check available markets
dpro-hl markets ls

# 2. Check your balance
dpro-hl balances

# 3. Set leverage
dpro-hl order set-leverage BTC 5

# 4. Place a limit order
dpro-hl order limit buy 0.001 BTC 50000

# 5. Check open orders
dpro-hl orders

# 6. Check positions
dpro-hl positions
```

### HIP-3 Workflow

```bash
# Discover exact symbol first
dpro-hl markets ls

# HIP-3 quote and trading
dpro-hl quote xyz:NVDA
dpro-hl order limit buy 1 xyz:NVDA 120
dpro-hl order market sell 1 xyz:NVDA --slippage 0.5
```

### Scripting with JSON Output

```bash
# Get raw JSON for automation
dpro-hl quote BTC --json
dpro-hl positions --json
dpro-hl onchain leaderboard --json
```

---

## Configuration

### Local Storage

| Path | Description |
|------|-------------|
| `~/.config/dpro-hl/config.json` | Account list, default account, network setting |
| `~/.config/dpro-hl/keys.enc` | AES-encrypted agent private keys |
| `~/.config/dpro-hl/upgrade-state.json` | Auto-upgrade check/update state and warning dedupe metadata |

Private keys are **never stored in plain text**. A master password is required to encrypt/decrypt keys.

### Runtime Context

When calling programmatically, pass options via `runtimeContext`:

| Key | Type | Description |
|-----|------|-------------|
| `password` | string | Master password to decrypt stored private keys |
| `network` | `'mainnet'` \| `'testnet'` | Target network (default: mainnet) |
| `autoUpgrade` | boolean | Enable/disable auto-upgrade for this invocation (default: `true`) |
| `autoUpgradeTimeoutMs` | number | Timeout budget in milliseconds for one upgrade pass (default: `2000`) |
| `autoUpgradeProvider` | `'auto' \| 'git' \| 'clawhub' \| 'off'` | Select provider routing for this invocation |
| `autoUpgradeCheckIntervalMs` | number | Clawhub provider check interval in milliseconds (default: `900000`) |
| `autoUpgradeClawhubCmd` | string | Clawhub command alias (default: `clawhub`) |
| `autoUpgradeDryRun` | boolean | Check-only mode for debugging (default: `false`) |
| `autoUpgradeDisableNpmInstall` | boolean | Skip `npm install` after a successful pull (default: `false`) |

---

## Project Structure

```
scripts/
├── entry.mjs               # Single entry point: runHyperliquidSkill()
├── auto-upgrade.mjs        # Per-invocation auto-upgrade checks
├── parser.mjs              # Input parsing (command + natural language)
├── router.mjs              # AST -> command handler dispatch
├── format.mjs              # Structured result -> text output
├── errors.mjs              # Typed error helpers
├── clients/
│   ├── info-client.mjs     # Read-only API (POST /info)
│   ├── exchange-client.mjs # Trading API (POST /exchange)
│   └── onchain-client.mjs  # Onchain GET API proxy
├── resolvers/              # Asset, account, market resolution
├── commands/
│   ├── market.mjs          # Market data commands
│   ├── account.mjs         # Account management and account reads
│   ├── trade.mjs           # Order execution and risk controls
│   └── onchain.mjs         # Onchain read commands
└── tests/                  # Unit tests (node:test)
```

## Development

```bash
# Smoke test
node --input-type=module -e "
  import { runHyperliquidSkill } from './scripts/entry.mjs';
  console.log(await runHyperliquidSkill('dpro-hl quote BTC'));
"
```

## Referral

Join Hyperliquid via:
- https://app.hyperliquid.xyz/join/DPRO1

## License

MIT
