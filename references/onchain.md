# Onchain API Reference

Read-only command group backed by `docs/openapi.json` allowlist.

## Base URL and Auth

| Item | Value |
|---|---|
| Auth | None (read-only endpoints only) |
| Base URL | `https://api.d.pro/` (fixed) |

Base URL configuration is not required.

---

## Endpoint Mapping

| Command | Method | Path |
|---|---|---|
| `dpro-hl onchain ping` | GET | `/api/v1` |
| `dpro-hl onchain health` | GET | `/api/v1/health` |
| `dpro-hl onchain mids` | GET | `/api/v1/hl/prices/mids` |
| `dpro-hl onchain spot-meta` | GET | `/api/v1/hl/meta/spot` |
| `dpro-hl onchain perps-meta` | GET | `/api/v1/hl/meta/perps-universe` |
| `dpro-hl onchain spot-holders` | GET | `/api/v1/hl/spot/holders` |
| `dpro-hl onchain spot-holder-counts` | GET | `/api/v1/hl/spot/holders/counts` |
| `dpro-hl onchain perp-holders` | GET | `/api/v1/hl/perp/holders` |
| `dpro-hl onchain liquidation-map` | GET | `/api/v1/hl/perp/liquidation-map` |
| `dpro-hl onchain leaderboard` | GET | `/api/v1/leaderboard` |

---

## Excluded Paths

| Pattern | Reason |
|---|---|
| `/api/v1/asset-data/*` | explicitly excluded |
| `/api/v1/news` | explicitly excluded |
| `/api/v1/mappings*` | explicitly excluded |
| `/api/v1/referral/*` | explicitly excluded |
| `/api/v1/claimable_balance` | explicitly excluded |
| `image/*` responses | non-text payload exclusion |

---

## HIP-3 Coin Normalization

For namespaced onchain perp queries:

| Input | Normalized query coin |
|---|---|
| `xyz:nvda` | `xyz:NVDA` |
| `XYZ:NVDA` | `xyz:NVDA` |

Rule: `dex` lowercase + `asset` uppercase.

---

## Response Shape Handling

### Envelope normalization
- Handles wrapped payloads such as `{ code, msg, data }`.

### `onchain mids`
- Reads mids map from `payload`, `payload.data`, or `payload.data.mids`.
- Ignores non-price object values to avoid `NaN` rows.

### `onchain spot-holders` / `perp-holders`
- Derives rank when API rank is absent.
- Applies page/limit rank offset when pagination is present.

### `onchain liquidation-map`
- Renders full heatmap table with:
  - `Coin`, `Bin`, `Start`, `End`, `Liq Value`, `Positions`, `Segment`

### `onchain leaderboard`
- Supports variant row schemas (`ethAddress`, `displayName`, `windowPerformances`, `accountValue`, etc.).
- Metric column follows `--sort` (default `pnl_day`).

---

## Examples

```bash
dpro-hl onchain health
dpro-hl onchain mids
dpro-hl onchain spot-holders PURR --limit 5
dpro-hl onchain perp-holders XYZ:NVDA --limit 5 --order desc
dpro-hl onchain liquidation-map xyz:TSLA
dpro-hl onchain leaderboard --limit 10 --sort pnl_day --order desc
```
