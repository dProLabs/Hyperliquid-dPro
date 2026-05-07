# Assets API Reference

Read-only reference for the `dpro-hl asset ...` command family.

This file defines:
- the asset command surface
- the public API base URL
- endpoint mapping
- query parameters
- response-shape handling
- failure behavior

Use `references/commands.md` for complete command syntax.

---

## Scope

The asset command group is:
- read-only
- backed by the public dPro assets API
- independent from Hyperliquid API-wallet credentials

Use this reference only for commands under:

`dpro-hl asset ...`

Do not expose assets through `dpro-hl onchain ...`; the onchain reference intentionally excludes asset-data paths.

---

## Base URL and Auth

| Item | Value |
|---|---|
| Auth | None |
| Mode | Read-only only |
| Default Base URL | `https://assets-api.d.pro` |
| Override | `DPRO_HL_ASSET_BASE_URL` or runtime `assetApiBaseUrl` |

Do not prompt for account selection, API-wallet password, master-wallet password, or API-wallet setup for asset commands.

---

## Commands

| Command | Method | Path | Purpose |
|---|---|---|---|
| `dpro-hl asset search <query>` | GET | `/api/search` | search assets |
| `dpro-hl asset ls --type <type>` | GET | `/api/assets` | paginated asset list |
| `dpro-hl asset detail <id>` | GET | `/api/assets/:id` | asset detail and metadata |
| `dpro-hl asset klines <id>` | GET | `/api/assets/:id/klines` | asset candles |
| `dpro-hl asset pairs <id>` | GET | `/api/assets/:id/tickers` | exchange pair rows |
| `dpro-hl asset sec-filings <id>` | GET | `/api/assets/:id/sec-filings` | SEC filing rows |
| `dpro-hl asset rwa` | GET | `/api/assets/rwa` | RWA asset rows |
| `dpro-hl asset stats` | GET | `/api/global-stats` | global market stats |

---

## Search

`dpro-hl asset search <query>`

Query parameter:
- `q`: required search text

Response `data` is an array of asset rows. The implementation returns richer rows than the public docs show, including price, market cap, rank, and display names when available.

Search is generic asset search. It does not provide the same Hyperliquid-aware `assetSymbol` resolution that news has.

---

## Asset List

`dpro-hl asset ls --type CRYPTO|STOCK|ETF|FOREX|COMMODITY [--market <code>] [--sort <field>] [--order asc|desc] [--page N] [--limit N]`

Query parameters:
- `type`: required, one of `CRYPTO`, `STOCK`, `ETF`, `FOREX`, `COMMODITY`
- `sort`: default `marketCap`
- `order`: `asc` or `desc`
- `market`: stock-only market filter, such as `US`, `HK`, or `OTHER`
- `page`: positive integer, default `1`
- `limit`: positive integer, default `20`, max `100`

Sort fields:
- `marketCap`
- `volume24h`
- `change24h`
- `change7d`
- `price`
- `priceUpdatedAt`
- `rank`
- `createdAt`
- `updatedAt`
- `name`
- `symbol`

Response `data` shape:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

Known docs/code mismatch:
- list rows do not include every field shown in the public docs, such as `high24h`, `low24h`, or `priceUpdatedAt`
- numeric fields are serialized as numbers, not strings

---

## Detail

`dpro-hl asset detail <assetId>`

Response includes the asset row plus `cryptoMeta` or `stockMeta` when available.

Missing assets return an API rejection from upstream.

---

## Klines

`dpro-hl asset klines <assetId> [--interval M1|M5|M15|H1|H4|D1|W1|MN1] [--limit N]`

Query parameters:
- `interval`: default `H1`
- `limit`: default `100`, max `500`

Response `data` is an array of candles with fields such as:
- `assetId`
- `interval`
- `openTime`
- `open`
- `high`
- `low`
- `close`
- `volume`

The upstream service can return stale cached rows if external sources fail.

---

## Pairs / Tickers

`dpro-hl asset pairs <assetId> [--venue all|cex|dex] [--market-type all|spot|perp|futures] [--page N] [--limit N]`

Query parameters:
- `venue`: `all`, `cex`, or `dex`, default `all`
- `marketType`: `all`, `spot`, `perp`, or `futures`, default `all`
- `page`: positive integer, default `1`
- `limit`: positive integer, default and max `100`

Response `data` shape:

```json
{
  "items": [],
  "page": 1,
  "limit": 100,
  "hasNext": false
}
```

Known docs/code mismatch:
- public docs show an array, but implementation returns the paged object above
- non-crypto non-RWA assets normally return an empty page

---

## SEC Filings

`dpro-hl asset sec-filings <assetId> [--page N] [--limit N]`

Response `data` shape:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

The upstream service does not enforce stock-only access; unknown assets can return an empty page.

---

## RWA List

`dpro-hl asset rwa [--sort <field>] [--order asc|desc] [--page N] [--limit N]`

Sort fields:
- `rank`
- `name`
- `symbol`
- `rwaPrice`
- `avgTokenPrice`
- `changePct`
- `marketCap`
- `volume`
- `tokenMcap`
- `tokenVol`
- `updatedAt`

Response `data` shape:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 50
}
```

---

## Global Stats

`dpro-hl asset stats`

Response `data` contains fields such as:
- `totalMarketCap`
- `totalVolume24h`
- `btcDominance`
- `ethDominance`
- `fearGreedIndex`
- `fearGreedLabel`
- `activeCryptos`
- `snapshotAt`

---

## Error Handling

When the API returns non-2xx, report an `API_REJECTED` error with the original status and body.

When the response has a non-zero `code`, report an `API_REJECTED` error with the API message.

When the request times out or the network fails, report a `NETWORK_ERROR`.
