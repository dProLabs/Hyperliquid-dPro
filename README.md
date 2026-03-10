# Hyperliquid-dPro

Hyperliquid-dPro is an agent skill for **Hyperliquid DEX** and **dPro onchain analytics**.
It provides a single skill surface for:

- market reads
- account reads and account management
- spot, perp, and HIP-3 trading
- dPro onchain read-only analytics

It is designed for AI agent environments such as **OpenClaw**, **Claude Code**, **Codex**, and **OpenCode**. No global CLI installation is required. The skill supports **200+ perpetual contracts**, **spot tokens**, and **namespaced HIP-3 assets**.

---

## Why this repo exists

This repository packages Hyperliquid workflows into a reusable agent skill instead of a standalone global CLI.

Key capabilities include:

- **Market data**: quotes, books, candles, movers, overview, and market listing
- **Account workflows**: encrypted multi-account storage, balances, positions, orders, fills, and portfolio views
- **Trading namespaces**: explicit `spot`, `perp`, and `hip3` order trees
- **Risk controls**: leverage updates and isolated-margin top-ups for supported perp-style markets
- **Onchain analytics**: mids, metadata, holder distribution, liquidation maps, and leaderboard views
- **Flexible invocation**: canonical command syntax, slash-style input, or natural language
- **Agent-first runtime**: programmatic entry point via `runHyperliquidSkill(...)`

The original README already covered these capabilities, installation paths, runtime context, account storage, and example commands; this rewrite keeps the same scope but organizes it around real usage flow.

---

## Quick start

### Fastest path: install with Clawhub

```bash
clawhub install github:dProLabs/Hyperliquid-dPro
```

Update manually if needed:

```bash
clawhub update github:dProLabs/Hyperliquid-dPro
```

Uninstall:

```bash
clawhub uninstall dpro-hl
```

Clawhub handles dependency resolution, version management, and skill registration automatically.

### Local development install

```bash
git clone https://github.com/dProLabs/Hyperliquid-dPro.git
cd Hyperliquid-dPro
npm install
```

---

## Supported environments

### Claude Code

Use the included plugin manifests:

```bash
/plugin marketplace add dProLabs/Hyperliquid-dPro
/plugin install dpro-hl
```

Manual install:

```bash
git clone https://github.com/dProLabs/Hyperliquid-dPro.git .claude/skills/dpro-hl
cd .claude/skills/dpro-hl
npm install
```

Then reference the skill in your agent config:

```markdown
Skills: .claude/skills/dpro-hl/SKILL.md
```

Plugin files:

- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

### Cursor

Use:

- `.cursor-plugin/plugin.json`

### Codex

See:

- `.codex/INSTALL.md`

### OpenCode

See:

- `.opencode/INSTALL.md`

### Other agent environments

Copy the skill directory into the environment's skill folder and ensure Node.js is available at runtime.

---

## How to use the skill

### Inside an agent

Once installed, talk to your agent using either natural language or canonical skill syntax.

Examples:

```text
dpro-hl quote BTC
dpro-hl book ETH --levels 5
dpro-hl markets ls
dpro-hl positions
dpro-hl perp order limit buy 0.01 BTC 50000
```

The agent should route requests through `SKILL.md` and resolve them into the command surface defined by the repository.

### Programmatic usage

```js
import { runHyperliquidSkill } from './scripts/entry.mjs';

// Read-only
const quote = await runHyperliquidSkill('dpro-hl quote BTC');
console.log(quote);

// Live trading
const order = await runHyperliquidSkill(
  'dpro-hl perp order limit buy 0.01 BTC 50000',
  { password: 'yourMasterPassword' }
);
console.log(order);
```

### Smoke test

```bash
node --input-type=module -e "
  import { runHyperliquidSkill } from './scripts/entry.mjs';
  console.log(await runHyperliquidSkill('dpro-hl quote BTC'));
"
```

---

## Command model

The skill is organized into four functional domains.

### 1. Market reads

```text
dpro-hl quote BTC
dpro-hl book ETH --levels 10
dpro-hl candles SOL --interval 1h --last 20
dpro-hl movers --top 10
dpro-hl overview --top 10
dpro-hl markets ls
```

### 2. Account management and account reads

```text
dpro-hl account ls
dpro-hl account add-readonly <address> [alias]
dpro-hl account add-api <masterAddress> <agentPrivateKey> [alias] --password <password>
dpro-hl account set-default <alias>
dpro-hl account remove <alias>

dpro-hl positions [alias|address]
dpro-hl balances [alias|address]
dpro-hl orders [alias|address]
dpro-hl fills [alias|address] --limit 50
dpro-hl portfolio [alias|address]
```

### 3. Trading namespaces

Trading uses explicit market namespaces.

#### Spot

```text
dpro-hl spot order limit buy 10 PURR 0.08
dpro-hl spot order market sell 10 PURR --slippage 0.5
dpro-hl spot order cancel <oid>
dpro-hl spot order cancel-all
dpro-hl spot order cancel-by-cloid PURR <cloid>
```

#### Perp

```text
dpro-hl perp order limit buy 0.001 BTC 50000
dpro-hl perp order market sell 0.1 ETH --slippage 0.5
dpro-hl perp order cancel <oid>
dpro-hl perp order cancel-all
dpro-hl perp order cancel-by-cloid BTC <cloid>
dpro-hl perp order set-leverage BTC 10 --cross
dpro-hl perp order topup-isolated BTC 100
```

#### HIP-3

```text
dpro-hl hip3 order limit buy 1 xyz:NVDA 120
dpro-hl hip3 order market sell 1 xyz:NVDA --slippage 0.3
dpro-hl hip3 order cancel <oid>
dpro-hl hip3 order cancel-all
dpro-hl hip3 order cancel-by-cloid xyz:NVDA <cloid>
dpro-hl hip3 order set-leverage xyz:NVDA 5 --cross
dpro-hl hip3 order topup-isolated xyz:NVDA 50
```

#### Builder approval

```text
dpro-hl approve-builder
```

### 4. Onchain reads

```text
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

---

## Trading safety notes

Live trading requires an API account and a password to decrypt stored private keys for write actions. The original README also documented `runtimeContext.password` and `--password <value>` support. In normal agent usage, prefer secure runtime input over exposing secrets in logs or shell history.

Important rules:

- use `spot`, `perp`, or `hip3` explicitly for live writes
- do not assume symbol equivalence across namespaces
- verify the exact tradable symbol with `dpro-hl markets ls`
- treat market orders as bounded IOC-limit orders with slippage protection
- leverage and isolated top-up apply only to supported perp-style markets
- use read-only accounts only for monitoring, never for writes

---

## Account setup

Accounts are stored under:

```text
~/.config/dpro-hl/
```

### Add a trading account

```text
dpro-hl account add-api <masterAddress> <agentPrivateKey> [alias]  --password <password>
```

To obtain a Hyperliquid API wallet:

1. Sign in via `https://app.hyperliquid.xyz/join/DPRO1`
2. Open `https://app.hyperliquid.xyz/API`
3. Create an API wallet
4. Copy the API wallet private key and note the master wallet address

Quick validation:

```text
dpro-hl account ls
dpro-hl positions <alias>
```

### Add a read-only account

```text
dpro-hl account add-readonly <address> [alias]
```

Configured accounts show alias, address, mode, and default status.

---

## Market data

Market queries do not require authentication.

### Quotes

```text
dpro-hl quote BTC
dpro-hl quote xyz:NVDA
```

Typical quote output includes price, 24h change, funding, open interest, mark/oracle, and 24h volume when available.

### Order book

```text
dpro-hl book ETH
dpro-hl book ETH --levels 20
```

### Candles

```text
dpro-hl candles BTC --interval 1h --last 48
```

Valid intervals:

`1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `8h`, `12h`, `1d`, `3d`, `1w`, `1M`

### Movers and overview

```text
dpro-hl movers --top 10
dpro-hl movers --side gainers
dpro-hl movers --side losers
dpro-hl overview --top 10
```

---

## Onchain analytics

Onchain reads are exposed under `dpro-hl onchain ...`.

Notes:

- namespaced perp coin normalization is `dex` lowercase + symbol uppercase
- example: `XYZ:nvda` -> `xyz:NVDA`
- the onchain base URL is fixed in runtime: `https://api.d.pro/`

Use cases:

- health and connectivity checks
- mids and metadata snapshots
- spot / perp holder analysis
- liquidation-map lookups
- leaderboard queries

For exact endpoint behavior and normalization rules, see `references/onchain.md`.

---

## Global flags

| Flag | Description |
|------|-------------|
| `--json` | Output raw JSON instead of formatted text |
| `--account <alias>` | Use a specific account for this command |
| `--password <value>` | Provide master password inline for write actions |

If possible, prefer secure runtime context for passwords instead of inline command arguments.

---

## Input styles

Three equivalent invocation styles are supported.

```text
dpro-hl quote BTC
/dpro-hl quote BTC
BTC price
SOL 1h candles last 48
dpro-hl perp order market buy 0.1 BTC
dpro-hl perp order market sell 0.1 ETH
```

---

## Example workflows

### Market + onchain check

```text
dpro-hl quote BTC
dpro-hl movers --top 5
dpro-hl book ETH --levels 10
dpro-hl onchain mids
```

### Perp trading flow

```text
dpro-hl markets ls
dpro-hl balances
dpro-hl perp order set-leverage BTC 5
dpro-hl perp order limit buy 0.001 BTC 50000
dpro-hl orders
dpro-hl positions
```

### HIP-3 flow

```text
dpro-hl markets ls
dpro-hl quote xyz:NVDA
dpro-hl hip3 order limit buy 1 xyz:NVDA 120
dpro-hl hip3 order market sell 1 xyz:NVDA --slippage 0.5
```

### JSON automation

```text
dpro-hl quote BTC --json
dpro-hl positions --json
dpro-hl onchain leaderboard --json
```

---

## Runtime context

When calling `runHyperliquidSkill(...)`, the runtime context may include:

| Key | Type | Description |
|-----|------|-------------|
| `password` | string | Master password to decrypt stored private keys |
| `network` | `'mainnet' \| 'testnet'` | Target network (default: mainnet) |
| `autoUpgrade` | boolean | Enable or disable auto-upgrade for this invocation |
| `autoUpgradeTimeoutMs` | number | Timeout budget in milliseconds for one upgrade pass |
| `autoUpgradeProvider` | `'auto' \| 'git' \| 'clawhub' \| 'off'` | Select provider routing for this invocation |
| `autoUpgradeCheckIntervalMs` | number | Clawhub provider check interval in milliseconds |
| `autoUpgradeClawhubCmd` | string | Clawhub command alias |
| `autoUpgradeDryRun` | boolean | Check-only mode for debugging |
| `autoUpgradeDisableNpmInstall` | boolean | Skip `npm install` after a successful pull |

Environment overrides:

- `DPRO_HL_AUTO_UPGRADE=0`
- `DPRO_HL_AUTO_UPGRADE_TIMEOUT_MS=2000`
- `DPRO_HL_AUTO_UPGRADE_PROVIDER=auto|git|clawhub|off`
- `DPRO_HL_AUTO_UPGRADE_CHECK_INTERVAL_MS=900000`
- `DPRO_HL_AUTO_UPGRADE_CLAWHUB_CMD=clawhub`
- `DPRO_HL_AUTO_UPGRADE_DISABLE_NPM=1`

Behavior:

- runs on each `runHyperliquidSkill(...)` invocation
- `git` installs use `git pull --ff-only` and `npm install --silent` when remote is ahead
- `clawhub` installs run `clawhub update <skill-slug>` on the configured interval
- failures and timeouts surface as a warning line without blocking the requested command

---

## Local storage

| Path | Description |
|------|-------------|
| `~/.config/dpro-hl/config.json` | Account list, default account, network setting |
| `~/.config/dpro-hl/keys.enc` | AES-encrypted agent private keys |
| `~/.config/dpro-hl/upgrade-state.json` | Auto-upgrade state and warning dedupe metadata |

Private keys are never stored in plain text. A master password is required to encrypt and decrypt keys.

---

## Project structure

```text
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

---

## Development

```bash
node --input-type=module -e "
  import { runHyperliquidSkill } from './scripts/entry.mjs';
  console.log(await runHyperliquidSkill('dpro-hl quote BTC'));
"
```

---

## References

- `SKILL.md`
- `references/commands.md`
- `references/onchain.md`
- `references/troubleshooting.md`

---

## Referral

Join Hyperliquid via:

- `https://app.hyperliquid.xyz/join/DPRO1`

---

## License

MIT
