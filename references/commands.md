# Hyperliquid-dPro Skill Reference

Complete command reference for this skill.

## Global Flags

These flags can be used across commands when applicable.

| Flag | Description |
|---|---|
| `--json` | Return raw JSON output |
| `--account <alias>` | Select account alias for account/trade queries |
| `--api-password <password>` | Provide API-wallet password for encrypted API key operations |
| `--master-password <password>` | Provide master-wallet password for encrypted master key operations |

### Password Cache Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DPRO_HL_PASSWORD_CACHE` | Enable process-crossing password session cache (`1`/`0`) | `1` |
| `DPRO_HL_PASSWORD_CACHE_TTL_SEC` | Cache TTL in seconds | `21600` |
| `DPRO_HL_PASSWORD_CACHE_FILE` | Override cache file path | `${HOME}/.config/dpro-hl/password-session.json` |

### Read-only API Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DPRO_HL_ASSET_BASE_URL` | Override dPro assets API base URL | `https://assets-api.d.pro` |
| `DPRO_HL_NEWS_BASE_URL` | Override dPro assets news API base URL | `https://assets-api.d.pro` |

## Input Modes

| Mode | Example |
|---|---|
| Command | `dpro-hl quote BTC` |
| Slash | `/dpro-hl quote BTC` |
| Natural language | `BTC price`, `BTC news`, `show my positions`, `buy 0.1 BTC perp` |

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

## Asset Commands

Asset commands are read-only and do not require Hyperliquid account credentials.

### `dpro-hl asset search <query>`

Search the dPro asset database. Use this first to resolve an `assetId` for detail, klines, pairs, or SEC filing commands.

**Examples:**
```bash
dpro-hl asset search BTC
dpro-hl asset search "Apple Inc"
```

### `dpro-hl asset ls --type CRYPTO|STOCK|ETF|FOREX|COMMODITY [--market <code>] [--sort <field>] [--order asc|desc] [--page N] [--limit N]`

List assets by type.

**Options:**
| Option | Description |
|---|---|
| `--type <type>` | Required asset type |
| `--market <code>` | Stock market filter, for example `US`, `HK`, or `OTHER` |
| `--sort <field>` | Sort field, default `marketCap` |
| `--order asc\|desc` | Sort order |
| `--page N` | Page number, default `1` |
| `--limit N` | Rows to request, default `20`, max `100` |

**Example:**
```bash
dpro-hl asset ls --type CRYPTO --sort marketCap --limit 20
```

### `dpro-hl asset detail <assetId>`

Get one asset with metadata.

### `dpro-hl asset klines <assetId> [--interval M1|M5|M15|H1|H4|D1|W1|MN1] [--limit N]`

Get asset candles. Default interval is `H1`; max limit is `500`.

### `dpro-hl asset pairs <assetId> [--venue all|cex|dex] [--market-type all|spot|perp|futures] [--page N] [--limit N]`

Get exchange pairs / tickers for an asset. Max limit is `100`.

Aliases: `asset tickers <assetId>`, `asset markets <assetId>`.

### `dpro-hl asset sec-filings <assetId> [--page N] [--limit N]`

Get SEC filing rows linked to an asset.

Aliases: `asset filings <assetId>`, `asset sec <assetId>`.

### `dpro-hl asset rwa [--sort <field>] [--order asc|desc] [--page N] [--limit N]`

List RWA rows from the dPro asset database.

### `dpro-hl asset stats`

Get global asset market stats.

See `references/assets.md` for upstream API response shapes and known docs/code mismatches.

---

## News Commands

News commands are read-only and do not require Hyperliquid account credentials.

### `dpro-hl news [asset] [--asset <symbol>] [--asset-id <id>] [--type <type>] [--category all|hot-24h|hot-7d] [--locale <locale>] [--page N] [--limit N]`

Get latest dPro asset news. Positional `[asset]` is passed as `assetSymbol` and supports Hyperliquid-aware symbols such as `BTC`, `xyz:AAPL`, `PEPE/USDC`, and `@12`.

**Options:**
| Option | Description |
|---|---|
| `--asset <symbol>` | Asset symbol filter; overrides positional asset |
| `--asset-id <id>` | Asset ID filter |
| `--type <type>` | `CRYPTO`, `STOCK`, `ETF`, `FOREX`, `COMMODITY`, or `ALL` |
| `--category all\|hot-24h\|hot-7d` | News window/category |
| `--locale <locale>` | Preferred locale, for example `en` or `zh-CN` |
| `--page N` | Page number, default `1` |
| `--limit N` | Rows to request, default `10`, max `100` |

**Examples:**
```bash
dpro-hl news BTC --limit 5
dpro-hl news --asset xyz:AAPL --category hot-24h --locale en
dpro-hl news list PEPE/USDC --category hot-7d
```

### `dpro-hl news detail <id> [--asset <symbol>] [--asset-id <id>] [--locale <locale>]`

Get one news item with full analysis when available.

**Examples:**
```bash
dpro-hl news detail 12345
dpro-hl news detail 12345 --asset BTC --locale zh-CN
```

See `references/news.md` for the upstream API response shape and symbol-resolution behavior.

---

## Account Management

### `dpro-hl account add-readonly <address> [alias]`

Add read-only account.

### `dpro-hl account add-api <masterAddress> <agentPrivKey> [alias]  --api-password <password>`

Add API account for write actions.

### `dpro-hl account add-master <masterAddress> <masterPrivKey>  --master-password <password>`

Add master private key mapping for a master address. Required for `dpro-hl transfer ...`.

### `dpro-hl account update-master <masterAddress> <masterPrivKey>  --master-password <password>`

Rotate/update stored master private key mapping for a master address.

### `dpro-hl account remove-master <masterAddress>  --master-password <password>`

Remove stored master private key mapping for a master address.

### `dpro-hl account ls`

List configured accounts.
Output columns include `MasterAddress` and `AgentAddress`:
- API accounts show both addresses.
- Read-only accounts show `AgentAddress` as `—`.

### `dpro-hl account remove <alias>`

Remove account by alias.

### `dpro-hl account set-default <alias>`

Set default account.

### `dpro-hl account clear-password-cache`

Clear local password session cache file.

---

## Account Query Shortcuts

### `dpro-hl positions [alias|address]`
### `dpro-hl balances [alias|address]`
### `dpro-hl orders [alias|address]`
### `dpro-hl fills [alias|address] [--limit N]`
### `dpro-hl order-history [alias|address] [--limit N]`
### `dpro-hl funding-history [alias|address] [--start-time <ms>] [--end-time <ms>] [--limit N]`
### `dpro-hl twap-history [alias|address] [--limit N]`
### `dpro-hl twap-fill-history [alias|address] [--limit N]`
### `dpro-hl portfolio [alias|address]`

**Example:**
```bash
dpro-hl positions
dpro-hl balances main
dpro-hl fills main --limit 50
```

---

## Transfer Commands

### `dpro-hl transfer <usd> [--to perp|spot]`

Transfer funds between spot and perp balance buckets.

**Options:**
| Option | Description |
|---|---|
| `--to perp\|spot` | Destination bucket. Default: `perp` |

**Rules:**
- `transfer` is a top-level command (not under `spot/perp/hip3 order ...`).
- `transfer` uses the stored **master wallet** private key for signing.
- If master key mapping for the selected account's `masterAddress` is missing, command fails with migration hint.
- API wallet alias and master key alias do not need to be the same; mapping is by `masterAddress`.

**Examples:**
```bash
dpro-hl transfer 10
dpro-hl transfer 25 --to spot
dpro-hl transfer 5 --to perp --account main
```

---

## Trade Commands

Trading is split into three explicit namespaces: **spot**, **perp**, **hip3**.

Use explicit trade namespaces for all write actions:
- `dpro-hl spot ...`
- `dpro-hl perp ...`
- `dpro-hl hip3 ...`

Do not rely on implicit market-type inference for live writes.

Signer policy for write actions:
- `spot/perp/hip3 order ...` -> API wallet signing
- `transfer ...` -> master wallet signing

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
### `dpro-hl spot order cancel-multiple <oid1,oid2,...>`
### `dpro-hl spot order modify <oid|cloid> buy|sell <size> <coin> <price> [--tif Gtc|Ioc|Alo]`
### `dpro-hl spot order batch-limit buy|sell <coin> <size@price,size@price,...> [--tif Gtc|Ioc|Alo]`
### `dpro-hl spot order twap-create buy|sell <size> <coin> --minutes <N> [--randomize]`
### `dpro-hl spot order twap-cancel <coin> <twapId>`

**Rules:**
- Spot does not support leverage-management commands.
- Reject leverage or isolated-margin operations on spot.
- `--reduce-only` is not part of the spot command surface unless explicitly added by the implementation.
- Before submit, check `maxBuilderFee(user=masterAddress,builder=BUILDER_ADDRESS)`; attach `builder: { b, f }` only when fee > 0.

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
### `dpro-hl perp order cancel-multiple <oid1,oid2,...>`
### `dpro-hl perp order modify <oid|cloid> buy|sell <size> <coin> <price> [--tif Gtc|Ioc|Alo] [--reduce-only]`
### `dpro-hl perp order batch-limit buy|sell <coin> <size@price,size@price,...> [--tif Gtc|Ioc|Alo] [--reduce-only]`
### `dpro-hl perp order twap-create buy|sell <size> <coin> --minutes <N> [--reduce-only] [--randomize]`
### `dpro-hl perp order twap-cancel <coin> <twapId>`
### `dpro-hl perp order close-position <coin> [--size <N>] [--limit-price <P>|--slippage <N>]`
### `dpro-hl perp order reverse-position <coin> [--size <N>] [--slippage <N>]`
### `dpro-hl perp order scale-order buy|sell <coin> --from <P> --to <P> --count <N> --total-size <N> [--tif Gtc|Ioc|Alo] [--reduce-only]`
### `dpro-hl perp order tpsl <coin> --tp <price> --sl <price> [--size <N>]`
### `dpro-hl perp order oto buy|sell <size> <coin> <entryPrice> --tp <price> --sl <price>`

### `dpro-hl perp order set-leverage <coin> <leverage> [--cross|--isolated]`
### `dpro-hl perp order topup-isolated <coin> <usd>`

**Rules:**
- `set-leverage` and `topup-isolated` are valid for perps.
- `topup-isolated` requires isolated-margin mode.
- Before submit, check `maxBuilderFee(user=masterAddress,builder=BUILDER_ADDRESS)`; attach `builder: { b, f }` only when fee > 0.

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
### `dpro-hl hip3 order cancel-multiple <oid1,oid2,...>`
### `dpro-hl hip3 order modify <oid|cloid> buy|sell <size> <coin> <price> [--tif Gtc|Ioc|Alo] [--reduce-only]`
### `dpro-hl hip3 order batch-limit buy|sell <coin> <size@price,size@price,...> [--tif Gtc|Ioc|Alo] [--reduce-only]`
### `dpro-hl hip3 order twap-create buy|sell <size> <coin> --minutes <N> [--reduce-only] [--randomize]`
### `dpro-hl hip3 order twap-cancel <coin> <twapId>`
### `dpro-hl hip3 order close-position <coin> [--size <N>] [--limit-price <P>|--slippage <N>]`
### `dpro-hl hip3 order reverse-position <coin> [--size <N>] [--slippage <N>]`
### `dpro-hl hip3 order scale-order buy|sell <coin> --from <P> --to <P> --count <N> --total-size <N> [--tif Gtc|Ioc|Alo] [--reduce-only]`
### `dpro-hl hip3 order tpsl <coin> --tp <price> --sl <price> [--size <N>]`
### `dpro-hl hip3 order oto buy|sell <size> <coin> <entryPrice> --tp <price> --sl <price>`

### `dpro-hl hip3 order set-leverage <coin> <leverage> [--cross|--isolated]`
### `dpro-hl hip3 order topup-isolated <coin> <usd>`

**Rules:**
- HIP-3 is its own trading namespace.
- Do not rewrite HIP-3 symbols into non-HIP-3 symbols.
- `set-leverage` and `topup-isolated` are only valid for supported perp-style HIP-3 instruments, not all HIP-3 assets.
- Before submit, check `maxBuilderFee(user=masterAddress,builder=BUILDER_ADDRESS)`; attach `builder: { b, f }` only when fee > 0.

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

### `dpro-hl builder-approval [alias|masterAddress] [--builder <builderAddress>]`

Check whether the selected user has already authorized the builder.

**Rules:**
- Resolve `user` from the selected account's `masterAddress` (or explicit address).
- Query `maxBuilderFee` using `user` and the selected `builder` address.
- `maxBuilderFee > 0` means approved; use it to decide whether to attach `{"b": builder, "f": fee}` to orders.
- When `maxBuilderFee = 0`, explicitly inform the user: "Please log in to https://www.d.pro/ to get trading fee discounts." Present this as an informational reminder, not as a warning.

---

## Onchain Commands

### `dpro-hl onchain ping`
### `dpro-hl onchain health`
### `dpro-hl onchain mids`
### `dpro-hl onchain spot-meta` (deprecated compatibility alias)
### `dpro-hl onchain perps-meta`
### `dpro-hl onchain address-tags`
### `dpro-hl onchain spot-holders <coin> [--order asc|desc] [--address <wallet>] [--page N] [--limit N]`
### `dpro-hl onchain spot-holder-counts`
### `dpro-hl onchain perp-holders <coin> [--sortBy value|pnl] [--order asc|desc] [--address <wallet>] [--page N] [--limit N]`
### `dpro-hl onchain orders-book <coin> [--page N] [--limit N]`
### `dpro-hl onchain orders-untriggered <coin> [--page N] [--limit N]`
### `dpro-hl onchain orders-chart <coin> [--type book|untriggered]`
### `dpro-hl onchain prediction-positions <outcomeId> [--order asc|desc] [--address <wallet>] [--page N] [--limit N]`
### `dpro-hl onchain prediction-orders-book [--coin <#N>|--outcome-id N --side 0|1] [--page N] [--limit N]`
### `dpro-hl onchain prediction-orders-book-batch [--coins <#N,#N>|--outcome-ids N,N [--sides 0,1]] [--page N] [--limit N]`
### `dpro-hl onchain prediction-orders-untriggered [--coin <#N>|--outcome-id N --side 0|1] [--page N] [--limit N]`
### `dpro-hl onchain prediction-orders-untriggered-batch [--coins <#N,#N>|--outcome-ids N,N [--sides 0,1]] [--page N] [--limit N]`
### `dpro-hl onchain tradfi-volume-top [--period 24h] [--limit N]`
### `dpro-hl onchain tradfi-gainers-top [--period 24h] [--limit N]`
### `dpro-hl onchain tradfi-gainers-holder-pnl-top [--period 24h] [--asset-limit N] [--holder-limit N]`
### `dpro-hl onchain liqmap <coin> [--groupBy all|smart|whale]`
### `dpro-hl onchain liquidation-map <coin> [--groupBy all|smart|whale]` (compat alias)
### `dpro-hl onchain liqmap-timeline <coin> --from <ISO> --to <ISO>`
### `dpro-hl onchain trending [--period 15m|1h|4h|24h] [--market all|spot|perp] [--page N] [--limit N]`
### `dpro-hl onchain leaderboard [--page N] [--limit N] [--sort field] [--order asc|desc]`
### `dpro-hl onchain hip3-fills <coin> [--startTime <ISO|ms>] [--endTime <ISO|ms>] [--page N] [--limit N]`
### `dpro-hl onchain hip3-smart-trader <coin> [--sort pnlPct|pnl|totalBuy|totalSell|portfolioValue|lastTradeAt] [--order asc|desc] [--address <wallet>] [--page N] [--limit N]`
### `dpro-hl onchain hip4-smart-trader <tokenId> [--sort pnlPct|pnl|totalBuy|totalSell|portfolioValue|lastTradeAt] [--order asc|desc] [--address <wallet>] [--page N] [--limit N]`

**Notes:**
- Prefer `--outcome-id` and `--side` for prediction orders because shell commands treat unquoted `#` as a comment.
- Prediction batch commands support at most 30 resolved prediction coins.
- TradFi ranking commands currently support only `--period 24h` and `--limit` up to 50.
- Smart-trader commands support `--limit` up to 500.

For endpoint mapping and response-shape details, see [`onchain.md`](onchain.md).
