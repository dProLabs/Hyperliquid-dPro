# News API Reference

Read-only reference for the `dpro-hl news ...` command family.

This file defines:
- the news command surface
- the public API base URL
- endpoint mapping
- query parameters
- response-shape handling
- failure behavior

Use `references/commands.md` for complete command syntax.

---

## Scope

The news command group is:
- read-only
- backed by the public dPro assets API
- independent from Hyperliquid API-wallet credentials

Use this reference only for commands under:

`dpro-hl news ...`

Do not expose news through `dpro-hl onchain ...`; the onchain reference intentionally excludes news paths.

---

## Base URL and Auth

| Item | Value |
|---|---|
| Auth | None |
| Mode | Read-only only |
| Default Base URL | `https://assets-api.d.pro` |
| Override | `DPRO_HL_NEWS_BASE_URL` or runtime `newsApiBaseUrl` |

Do not prompt for account selection, API-wallet password, master-wallet password, or API-wallet setup for news commands.

---

## Commands

| Command | Method | Path | Purpose |
|---|---|---|---|
| `dpro-hl news [asset]` | GET | `/api/news` | latest news list |
| `dpro-hl news --asset <symbol>` | GET | `/api/news` | asset-filtered news list |
| `dpro-hl news detail <id>` | GET | `/api/news/:id` | single news detail with analysis |

---

## List Query Parameters

`dpro-hl news [asset] [--asset <symbol>] [--asset-id <id>] [--type <type>] [--category <category>] [--locale <locale>] [--page N] [--limit N]`

| Option | API Param | Notes |
|---|---|---|
| positional `[asset]` | `assetSymbol` | Hyperliquid-aware symbol filter |
| `--asset <symbol>` | `assetSymbol` | Overrides positional asset |
| `--asset-id <id>` | `assetId` | Takes precedence upstream when both are present |
| `--type <type>` | `type` | `CRYPTO`, `STOCK`, `ETF`, `FOREX`, `COMMODITY`, `ALL` |
| `--category <category>` | `category` | `all`, `hot-24h`, `hot-7d` |
| `--locale <locale>` | `locale` | Examples: `en`, `zh-CN`, `fr` |
| `--page N` | `page` | Positive integer, default command value is `1` |
| `--limit N` | `limit` | Positive integer up to `100`, default command value is `10` |

The upstream DTO default for `limit` is `100`; the command uses `10` by default to keep terminal output concise.

Supported `assetSymbol` forms include:
- `BTC`
- `xyz:AAPL`
- `PEPE/USDC`
- `@12`

---

## Detail Query Parameters

`dpro-hl news detail <id> [--asset <symbol>] [--asset-id <id>] [--locale <locale>]`

| Option | API Param | Notes |
|---|---|---|
| `<id>` | path id | Positive integer news id |
| `--asset <symbol>` | `assetSymbol` | Filters returned `assets` only |
| `--asset-id <id>` | `assetId` | Filters returned `assets` only |
| `--locale <locale>` | `locale` | Preferred analysis locale, upstream falls back to `en` |

If an asset filter cannot resolve on detail, the API can return the news body with `assets: []` rather than 404.

---

## Response Shape

All REST responses are wrapped:

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Consume `data`, not the top-level object.

List `data` shape:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 10
}
```

Important list item fields:
- `id`
- `title`
- `summary`
- `url`
- `publishedAt`
- `source`
- `publisher`
- `sentiment`
- `contentClass`
- `assets`
- `translationReady`
- `directionDisplay`

Detail responses include `analysis` when available, with fields such as:
- `locale`
- `coreSummary`
- `direction`
- `affectedAssets`
- `impactLogic`
- `timeHorizon`
- `risksAndWatchlist`

---

## Error Handling

When the API returns non-2xx, report an `API_REJECTED` error with the original status and body.

When the response has a non-zero `code`, report an `API_REJECTED` error with the API message.

When the request times out or the network fails, report a `NETWORK_ERROR`.

One retry can be safe for read-only news network errors, but the implementation does not retry by default.
