# Hyperliquid-dPro Skill Reference

Complete command reference for this skill.

## Global Flags

These flags can be used across commands when applicable.

| Flag | Description |
|---|---|
| `--json` | Return raw JSON output |
| `--account <alias>` | Select account alias for account/trade queries |
| `--password <password>` | Provide master password for encrypted API-key operations |

---

## Input Modes

| Mode | Example |
|---|---|
| Command | `hl quote BTC` |
| Slash | `/hl quote BTC` |
| Natural language | `BTC price`, `ETH order book`, `buy 0.1 BTC` |

---

## Market Commands

### `hl quote <coin>`

Get quote summary for a symbol.

**Examples:**
```bash
hl quote BTC
hl quote xyz:NVDA
```

### `hl book <coin> [--levels N]`

Get L2 order book.

**Options:**
| Option | Description |
|---|---|
| `--levels N` | Depth levels to display |

**Example:**
```bash
hl book ETH --levels 10
```

### `hl candles <coin> --interval <iv> [--last N]`

Get candle snapshots.

**Options:**
| Option | Description |
|---|---|
| `--interval <iv>` | Required candle interval |
| `--last N` | Number of candles |

**Valid intervals:**
`1m,3m,5m,15m,30m,1h,2h,4h,8h,12h,1d,3d,1w,1M`

**Example:**
```bash
hl candles SOL --interval 1h --last 48
```

### `hl movers [--top N] [--side gainers|losers]`

**Options:**
| Option | Description |
|---|---|
| `--top N` | Number of rows |
| `--side gainers\|losers` | Direction filter |

### `hl overview [--top N]`

Get combined market overview sections.

### `hl markets ls`

List markets and symbols. Use this output as symbol source of truth.

---

## Account Management

### `hl account add-readonly <address> [alias]`

Add read-only account.

### `hl account add-api <masterAddress> <agentPrivKey> [alias]`

Add API account for write actions.

### `hl account ls`

List configured accounts.

### `hl account remove <alias>`

Remove account by alias.

### `hl account set-default <alias>`

Set default account.

---

## Account Query Shortcuts

### `hl positions [alias|address]`
### `hl balances [alias|address]`
### `hl orders [alias|address]`
### `hl fills [alias|address] [--limit N]`
### `hl portfolio [alias|address]`

**Example:**
```bash
hl positions
hl balances main
hl fills main --limit 50
```

---

## Trade Commands

Trading has three equal modules: **spot**, **perps**, **HIP-3**.

### `hl order limit buy|sell <size> <coin> <price> [--tif Gtc|Ioc|Alo] [--reduce-only]`

**Options:**
| Option | Description |
|---|---|
| `--tif Gtc\|Ioc\|Alo` | Time-in-force |
| `--reduce-only` | Reduce-only order |

**Examples:**
```bash
hl order limit buy 10 PURR 0.08
hl order limit buy 0.01 BTC 50000
hl order limit buy 1 xyz:NVDA 120
```

### `hl order market buy|sell <size> <coin> [--slippage N] [--reduce-only]`

**Options:**
| Option | Description |
|---|---|
| `--slippage N` | Slippage percent |
| `--reduce-only` | Reduce-only order |

**Notes:**
- Market path is implemented as IOC limit with slippage protection.

### `hl order cancel <oid>`
### `hl order cancel-all`
### `hl order cancel-by-cloid <coin> <cloid>`

### `hl order set-leverage <coin> <leverage> [--cross|--isolated]`
### `hl order topup-isolated <coin> <usd>`

**Rules:**
- `set-leverage` and `topup-isolated` are perps-only (including HIP-3 perps), not spot.

### `hl approve-builder`

Approve builder fee capability for the account.

---

## Onchain Commands

### `hl onchain ping`
### `hl onchain health`
### `hl onchain mids`
### `hl onchain spot-meta`
### `hl onchain perps-meta`
### `hl onchain spot-holders <coin> [--page N] [--limit N]`
### `hl onchain spot-holder-counts`
### `hl onchain perp-holders <coin> [--sortBy field] [--order asc|desc] [--page N] [--limit N]`
### `hl onchain liquidation-map <coin>`
### `hl onchain leaderboard [--page N] [--limit N] [--sort field] [--order asc|desc]`

For endpoint mapping and response-shape details, see [`onchain.md`](onchain.md).
