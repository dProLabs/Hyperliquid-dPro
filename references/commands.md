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
| Command | `dpro-hl quote BTC` |
| Slash | `/dpro-hl quote BTC` |
| Natural language | `BTC price`, `ETH order book`, `buy 0.1 BTC` |

---

## Market Commands

### `dpro-hl quote <coin>`

Get quote summary for a symbol.

**Examples:**
```bash
dpro-hl quote BTC
dpro-hl quote xyz:NVDA
```

### `dpro-hl book <coin> [--levels N]`

Get L2 order book.

**Options:**
| Option | Description |
|---|---|
| `--levels N` | Depth levels to display |

**Example:**
```bash
dpro-hl book ETH --levels 10
```

### `dpro-hl candles <coin> --interval <iv> [--last N]`

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
dpro-hl candles SOL --interval 1h --last 48
```

### `dpro-hl movers [--top N] [--side gainers|losers]`

**Options:**
| Option | Description |
|---|---|
| `--top N` | Number of rows |
| `--side gainers\|losers` | Direction filter |

### `dpro-hl overview [--top N]`

Get combined market overview sections.

### `dpro-hl markets ls`

List markets and symbols. Use this output as symbol source of truth.

---

## Account Management

### `dpro-hl account add-readonly <address> [alias]`

Add read-only account.

### `dpro-hl account add-api <masterAddress> <agentPrivKey> [alias]`

Add API account for write actions.

### `dpro-hl account ls`

List configured accounts.

### `dpro-hl account remove <alias>`

Remove account by alias.

### `dpro-hl account set-default <alias>`

Set default account.

---

## Account Query Shortcuts

### `dpro-hl positions [alias|address]`
### `dpro-hl balances [alias|address]`
### `dpro-hl orders [alias|address]`
### `dpro-hl fills [alias|address] [--limit N]`
### `dpro-hl portfolio [alias|address]`

**Example:**
```bash
dpro-hl positions
dpro-hl balances main
dpro-hl fills main --limit 50
```

---

## Trade Commands

Trading has three equal modules: **spot**, **perps**, **HIP-3**.

### `dpro-hl order limit buy|sell <size> <coin> <price> [--tif Gtc|Ioc|Alo] [--reduce-only]`

**Options:**
| Option | Description |
|---|---|
| `--tif Gtc\|Ioc\|Alo` | Time-in-force |
| `--reduce-only` | Reduce-only order |

**Examples:**
```bash
dpro-hl order limit buy 10 PURR 0.08
dpro-hl order limit buy 0.01 BTC 50000
dpro-hl order limit buy 1 xyz:NVDA 120
```

### `dpro-hl order market buy|sell <size> <coin> [--slippage N] [--reduce-only]`

**Options:**
| Option | Description |
|---|---|
| `--slippage N` | Slippage percent |
| `--reduce-only` | Reduce-only order |

**Notes:**
- Market path is implemented as IOC limit with slippage protection.

### `dpro-hl order cancel <oid>`
### `dpro-hl order cancel-all`
### `dpro-hl order cancel-by-cloid <coin> <cloid>`

### `dpro-hl order set-leverage <coin> <leverage> [--cross|--isolated]`
### `dpro-hl order topup-isolated <coin> <usd>`

**Rules:**
- `set-leverage` and `topup-isolated` are perps-only (including HIP-3 perps), not spot.

### `dpro-hl approve-builder`

Approve builder fee capability for the account.

---

## Onchain Commands

### `dpro-hl onchain ping`
### `dpro-hl onchain health`
### `dpro-hl onchain mids`
### `dpro-hl onchain spot-meta`
### `dpro-hl onchain perps-meta`
### `dpro-hl onchain spot-holders <coin> [--page N] [--limit N]`
### `dpro-hl onchain spot-holder-counts`
### `dpro-hl onchain perp-holders <coin> [--sortBy field] [--order asc|desc] [--page N] [--limit N]`
### `dpro-hl onchain liquidation-map <coin>`
### `dpro-hl onchain leaderboard [--page N] [--limit N] [--sort field] [--order asc|desc]`

For endpoint mapping and response-shape details, see [`onchain.md`](onchain.md).
