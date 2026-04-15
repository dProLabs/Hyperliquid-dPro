# Onchain API Reference

Read-only reference for the `dpro-hl onchain ...` command family.

This file defines:
- the allowlisted onchain command surface
- endpoint mapping
- normalization rules
- response-shape handling
- exclusions and failure behavior

This file does **not** define account, trading, or write behavior.
Use:
- `SKILL.md` for routing and execution policy
- `references/commands.md` for the full command surface
- `references/troubleshooting.md` for runtime diagnosis and fixes

---

## Scope

The onchain command group is:
- **read-only**
- backed by an allowlisted subset of the dPro API
- fixed to the dPro public base URL
- independent from Hyperliquid API-wallet credentials

Use this reference only for commands under:

`dpro-hl onchain ...`

---

## Base URL and Auth

| Item | Value |
|---|---|
| Auth | None |
| Mode | Read-only only |
| Base URL | `https://api.d.pro/` |

Do not prompt for account selection, password, or API-wallet setup for onchain commands.

---

## Allowlisted Commands

| Command | Method | Path | Purpose |
|---|---|---|---|
| `dpro-hl onchain ping` | GET | `/api/v1` | basic reachability |
| `dpro-hl onchain health` | GET | `/api/v1/health` | service health |
| `dpro-hl onchain mids` | GET | `/api/v1/hl/prices/mids` | current mids map |
| `dpro-hl onchain spot-meta` | local warning | n/a | deprecated compatibility alias |
| `dpro-hl onchain perps-meta` | GET | `/api/v1/hl/meta/perps-universe` | perp universe metadata |
| `dpro-hl onchain address-tags` | GET | `/api/v1/hl/meta/address-tags` | address tag map |
| `dpro-hl onchain spot-holders <coin>` | GET | `/api/v1/hl/spot/holders` | spot holder rows |
| `dpro-hl onchain spot-holder-counts` | GET | `/api/v1/hl/spot/holders/counts` | spot holder counts by asset |
| `dpro-hl onchain perp-holders <coin>` | GET | `/api/v1/hl/perp/holders` | perp holder rows |
| `dpro-hl onchain orders-book <coin>` | GET | `/api/v1/hl/orders/book` | paginated order book rows |
| `dpro-hl onchain orders-untriggered <coin>` | GET | `/api/v1/hl/orders/untriggered` | paginated conditional order rows |
| `dpro-hl onchain orders-chart <coin>` | GET | `/api/v1/hl/orders/chart` | order chart bins + cumulative curves |
| `dpro-hl onchain liqmap <coin>` | GET | `/api/v1/hl/liqmap` | liquidation heatmap bins |
| `dpro-hl onchain liquidation-map <coin>` | GET | `/api/v1/hl/liqmap` | compatibility alias for `liqmap` |
| `dpro-hl onchain liqmap-timeline <coin>` | GET | `/api/v1/hl/liqmap/timeline` | historical liquidation snapshots |
| `dpro-hl onchain trending` | GET | `/api/v1/hl/trending` | spot/perp trending rows |
| `dpro-hl onchain leaderboard` | GET | `/api/v1/leaderboard` | leaderboard rows |

Only these commands are in scope for the onchain branch.

---

## Excluded Paths

The following API surfaces are intentionally excluded from this skill.
Do not expose them as `dpro-hl onchain ...` commands.

| Pattern | Reason |
|---|---|
| `/api/v1/asset-data/*` | explicitly excluded |
| `/api/v1/news` | explicitly excluded |
| `/api/v1/mappings*` | explicitly excluded |
| `/api/v1/referral/*` | explicitly excluded |
| `/api/v1/claimable_balance` | explicitly excluded |
| `image/*` responses | non-text payload exclusion |

If a user asks for one of these, explain that it is outside the allowlisted onchain command group.

---

## Input Normalization Rules

### Coin normalization
Apply normalization only where the endpoint expects a coin argument.

#### Standard symbols
- Preserve exact asset names when already canonical.
- Do not silently rewrite unrelated symbols.

#### HIP-3 namespaced perp symbols
For namespaced onchain perp queries, normalize to:
- `dex` lowercase
- `asset` uppercase

Examples:

| Input | Normalized query coin |
|---|---|
| `xyz:nvda` | `xyz:NVDA` |
| `XYZ:NVDA` | `xyz:NVDA` |
| `XyZ:tsla` | `xyz:TSLA` |

### Pagination normalization
For endpoints that support paging:
- preserve `page` and `limit` if provided
- otherwise use implementation defaults
- when rank is derived, apply page/limit offset consistently

### Sorting normalization
For endpoints that support sorting:
- pass through supported `--sort` and `--order` values
- do not invent unsupported sort keys

---

## Command Notes by Endpoint

### `dpro-hl onchain ping`
Use for a minimal connectivity check.

Expected behavior:
- confirms the base endpoint is reachable
- does not imply full downstream endpoint health

### `dpro-hl onchain health`
Use for a stronger service-health check.

Expected behavior:
- returns health status from the dedicated health path
- prefer this over `ping` when the user asks whether the service is healthy

### `dpro-hl onchain mids`
Use for the current mids map.

Expected behavior:
- return a normalized price table
- ignore rows that do not parse into numeric price values
- do not emit `NaN` rows

### `dpro-hl onchain spot-meta`
`/api/v1/hl/meta/spot` is removed upstream.

Expected behavior:
- return a local deprecation warning
- suggest replacements: `spot-holder-counts`, `markets ls`, or `perps-meta`

### `dpro-hl onchain perps-meta`
Use for perp universe metadata.

Expected behavior:
- return normalized perp metadata rows or payload summary
- preserve the raw structure for downstream use if requested

### `dpro-hl onchain spot-holders <coin>`
Use for spot holder distribution for a single asset.

Expected behavior:
- require an exact coin
- support optional `order` and `address` filters
- derive `rank` when missing
- apply pagination offset to derived rank when needed

### `dpro-hl onchain spot-holder-counts`
Use for count-style spot holder coverage.

Expected behavior:
- return asset-level holder counts
- no per-address ranking is required

### `dpro-hl onchain perp-holders <coin>`
Use for perp holder distribution for a single asset.

Expected behavior:
- require an exact coin
- normalize namespaced HIP-3 perp coins when applicable
- support optional address filter
- derive `rank` when missing
- apply sorting and ordering consistently

### `dpro-hl onchain orders-book <coin>`
Use for paginated order book snapshots.

Expected behavior:
- require an exact coin
- support paging via `page` / `limit`
- render key order fields in table form

### `dpro-hl onchain orders-untriggered <coin>`
Use for paginated untriggered/conditional orders.

Expected behavior:
- require an exact coin
- support paging via `page` / `limit`
- render trigger-related fields when available

### `dpro-hl onchain orders-chart <coin>`
Use for order-value distribution and cumulative depth curves.

Expected behavior:
- require an exact coin
- support `type=book|untriggered`
- render heatmap bins in tabular output

### `dpro-hl onchain liqmap <coin>`
Use for liquidation heatmap inspection.

Expected behavior:
- require an exact coin
- support `groupBy=all|smart|whale`
- render a normalized table with at least:
  - `Coin`
  - `Bin`
  - `Start`
  - `End`
  - `Liq Value`
  - `Positions`
  - `Segment`

### `dpro-hl onchain liqmap-timeline <coin>`
Use for historical liquidation map snapshots.

Expected behavior:
- require exact coin and both `from`/`to` ISO timestamps
- render snapshot time + height + bin coverage

### `dpro-hl onchain trending`
Use for trending market views.

Expected behavior:
- support `period=15m|1h|4h|24h`
- support `market=all|spot|perp`
- render grouped summaries for `all` and paginated tables for single-market mode

### `dpro-hl onchain leaderboard`
Use for leaderboard views.

Expected behavior:
- support variant row schemas
- normalize a display-friendly row shape even if upstream fields differ
- metric column should follow `--sort` when supplied
- default metric follows implementation default when `--sort` is absent

---

## Response Shape Handling

### Envelope normalization
Some endpoints may return wrapped payloads such as:

- `{ code, msg, data }`
- `{ data: ... }`
- plain arrays or plain objects

Consumers should normalize by:
1. checking `payload.data` first when a wrapper exists
2. falling back to the top-level payload when it is already the useful body
3. preserving the original payload for raw-output mode

### Table-first rendering
When the endpoint naturally returns rows, prefer normalized tables for human-facing output.

### Raw-output mode
When the user asks for raw structured data, return the raw normalized payload rather than only the rendered summary.

---

## Recommended Output Shapes

These are presentation targets, not strict upstream API schemas.

### Mids
| Field | Notes |
|---|---|
| `coin` | asset key |
| `mid` | numeric mid price |

### Spot / Perp Holders
| Field | Notes |
|---|---|
| `rank` | API-provided or derived |
| `address` | holder address |
| `size` | position or holding size when available |
| `value` | notional or value when available |
| `share` | percentage share when available |

### Liquidation Map
| Field | Notes |
|---|---|
| `coin` | asset |
| `bin` | bucket identifier |
| `start` | bucket start |
| `end` | bucket end |
| `liqValue` | liquidation value |
| `positions` | affected positions |
| `segment` | long/short or equivalent segment |

### Leaderboard
| Field | Notes |
|---|---|
| `rank` | leaderboard rank |
| `address` | account identifier |
| `displayName` | optional display label |
| `metric` | selected metric or default metric |
| `accountValue` | account value when available |

### Orders
| Field | Notes |
|---|---|
| `oid` | order id |
| `side` | bid/ask indicator |
| `size` | order size |
| `price` | order price |

### Trending
| Field | Notes |
|---|---|
| `market` | spot/perp/all |
| `period` | selected period |
| `items` | item rows or grouped totals |

---

## Failure Behavior

Onchain commands are read-only, so failure handling should be conservative but simple.

### Safe to retry once
A single retry is usually acceptable for:
- transient network failure
- temporary upstream timeout
- intermittent health-check failure

### Do not retry blindly
Do not retry repeatedly when:
- the coin is invalid or unresolved
- the command maps to an excluded path
- the endpoint returns a stable client-side validation error

### Escalate to troubleshooting
If the cause is unclear, consult `references/troubleshooting.md` and present:
- likely cause
- shortest direct fix
- whether retry is safe

---

## Examples

```text
# health / connectivity
 dpro-hl onchain ping
 dpro-hl onchain health

# prices and metadata
 dpro-hl onchain mids
 dpro-hl onchain perps-meta
 dpro-hl onchain address-tags

# holder distribution
 dpro-hl onchain spot-holders PURR --order desc --limit 5
 dpro-hl onchain spot-holder-counts
 dpro-hl onchain perp-holders xyz:NVDA --address 0xabc --limit 5 --order desc

# orders and trending
 dpro-hl onchain orders-book BTC --page 1 --limit 20
 dpro-hl onchain orders-chart BTC --type book
 dpro-hl onchain trending --period 1h --market all

# liquidation map
 dpro-hl onchain liqmap xyz:TSLA --groupBy all
 dpro-hl onchain liqmap-timeline BTC --from 2025-01-01T00:00:00Z --to 2025-01-07T00:00:00Z

# leaderboard
 dpro-hl onchain leaderboard --limit 10 --sort pnl_day --order desc
```

---

## Maintenance Notes

Update this file when any of the following change:
- allowlisted onchain commands
- API endpoint mapping
- excluded paths
- normalization rules
- response-shape handling expectations

Do not put trade-write logic, account-password rules, or account-setup flows in this file.
