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
| Natural language | `BTC price`, `show my positions`, `buy 0.1 BTC perp` |

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

### `dpro-hl account add-api <masterAddress> <agentPrivKey> [alias]  --password <password>`

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

Trading is split into three explicit namespaces: **spot**, **perp**, **hip3**.

Use explicit trade namespaces for all write actions:
- `dpro-hl spot ...`
- `dpro-hl perp ...`
- `dpro-hl hip3 ...`

Do not rely on implicit market-type inference for live writes.

### Spot Commands

### `dpro-hl spot order limit buy|sell <size> <coin> <price> [--tif Gtc|Ioc|Alo]`

**Options:**
| Option | Description |
|---|---|
| `--tif Gtc\|Ioc\|Alo` | Time-in-force |

**Examples:**
```bash
dpro-hl spot order limit buy 10 PURR 0.08
dpro-hl spot order limit sell 5 HYPE 25.5
```

### `dpro-hl spot order market buy|sell <size> <coin> [--slippage N]`

**Options:**
| Option | Description |
|---|---|
| `--slippage N` | Slippage percent |

**Notes:**
- Market path is implemented as IOC limit with slippage protection.

**Examples:**
```bash
dpro-hl spot order market buy 10 PURR --slippage 0.5
dpro-hl spot order market sell 1 HYPE --slippage 0.3
```

### `dpro-hl spot order cancel <oid>`
### `dpro-hl spot order cancel-all`
### `dpro-hl spot order cancel-by-cloid <coin> <cloid>`

**Rules:**
- Spot does not support leverage-management commands.
- Reject leverage or isolated-margin operations on spot.
- `--reduce-only` is not part of the spot command surface unless explicitly added by the implementation.

---

### Perp Commands

### `dpro-hl perp order limit buy|sell <size> <coin> <price> [--tif Gtc|Ioc|Alo] [--reduce-only]`

**Options:**
| Option | Description |
|---|---|
| `--tif Gtc\|Ioc\|Alo` | Time-in-force |
| `--reduce-only` | Reduce-only order |

**Examples:**
```bash
dpro-hl perp order limit buy 0.01 BTC 50000
dpro-hl perp order limit sell 1 ETH 3200 --reduce-only
```

### `dpro-hl perp order market buy|sell <size> <coin> [--slippage N] [--reduce-only]`

**Options:**
| Option | Description |
|---|---|
| `--slippage N` | Slippage percent |
| `--reduce-only` | Reduce-only order |

**Notes:**
- Market path is implemented as IOC limit with slippage protection.

**Examples:**
```bash
dpro-hl perp order market buy 0.01 BTC --slippage 0.5
dpro-hl perp order market sell 1 ETH --slippage 0.3 --reduce-only
```

### `dpro-hl perp order cancel <oid>`
### `dpro-hl perp order cancel-all`
### `dpro-hl perp order cancel-by-cloid <coin> <cloid>`

### `dpro-hl perp order set-leverage <coin> <leverage> [--cross|--isolated]`
### `dpro-hl perp order topup-isolated <coin> <usd>`

**Rules:**
- `set-leverage` and `topup-isolated` are valid for perps.
- `topup-isolated` requires isolated-margin mode.

**Examples:**
```bash
dpro-hl perp order set-leverage BTC 5 --cross
dpro-hl perp order topup-isolated ETH 50
```

---

### HIP-3 Commands

### `dpro-hl hip3 order limit buy|sell <size> <coin> <price> [--tif Gtc|Ioc|Alo] [--reduce-only]`

**Options:**
| Option | Description |
|---|---|
| `--tif Gtc\|Ioc\|Alo` | Time-in-force |
| `--reduce-only` | Reduce-only order for supported perp-style HIP-3 instruments |

**Examples:**
```bash
dpro-hl hip3 order limit buy 1 xyz:NVDA 120
dpro-hl hip3 order limit sell 1 xyz:TSLA 210 --reduce-only
```

### `dpro-hl hip3 order market buy|sell <size> <coin> [--slippage N] [--reduce-only]`

**Options:**
| Option | Description |
|---|---|
| `--slippage N` | Slippage percent |
| `--reduce-only` | Reduce-only order for supported perp-style HIP-3 instruments |

**Notes:**
- Market path is implemented as IOC limit with slippage protection.

**Examples:**
```bash
dpro-hl hip3 order market buy 1 xyz:NVDA --slippage 0.5
dpro-hl hip3 order market sell 1 xyz:TSLA --slippage 0.5 --reduce-only
```

### `dpro-hl hip3 order cancel <oid>`
### `dpro-hl hip3 order cancel-all`
### `dpro-hl hip3 order cancel-by-cloid <coin> <cloid>`

### `dpro-hl hip3 order set-leverage <coin> <leverage> [--cross|--isolated]`
### `dpro-hl hip3 order topup-isolated <coin> <usd>`

**Rules:**
- HIP-3 is its own trading namespace.
- Do not rewrite HIP-3 symbols into non-HIP-3 symbols.
- `set-leverage` and `topup-isolated` are only valid for supported perp-style HIP-3 instruments, not all HIP-3 assets.

**Examples:**
```bash
dpro-hl hip3 order set-leverage xyz:NVDA 5 --cross
dpro-hl hip3 order topup-isolated xyz:NVDA 50
```

---

### `dpro-hl approve-builder`

Approve builder fee capability for the account.

**Rules:**
- Treat builder approval as a persistent account-affecting action.
- Use explicit confirmation before execution in agent-driven flows.

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
