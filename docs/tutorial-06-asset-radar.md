# Tutorial 6: Researching Assets Before You Trade

This tutorial is for people who want to research assets before moving into account checks, onchain analysis, or live trading.

The goal here is not to place orders. The goal is to use natural language to ask the agent for asset metadata, market lists, candles, exchange pairs, RWA rows, SEC filings, and global market stats.

## What You Can Do

You can use natural language to ask the agent to check:
- Asset search results for a ticker or name
- Top assets by type, such as crypto, stocks, ETFs, forex, or commodities
- Asset detail pages and metadata
- Historical candles for a known asset id
- Exchange pairs and venue coverage for an asset
- RWA asset rows
- SEC filings for stock-style assets
- Global asset market stats

## How to Start

Start with a simple asset search:

> Find BTC in the dPro asset database.

> **Execution Result**
>
> ```
> Asset search
> Query: BTC
>
> ID       Symbol  Type    Market  Rank  Price       24h     MCap                  Name
> ----------------------------------------------------------------------------------------
> 3202730  BTC     CRYPTO  -       1     104,250.12  +1.18%  $2,071,000,000,000.00 Bitcoin
> 912441   WBTC    CRYPTO  -       14    104,190.44  +1.11%  $13,802,000,000.00    Wrapped Bitcoin
> 777120   BTCDOM  CRYPTO  -       -     51.42       -0.22%  -                     Bitcoin Dominance
> ```

The important thing to notice is the asset id. When you want deeper data, tell the agent which asset id to open.

> Open asset 3202730 and show its profile.

> **Execution Result**
>
> ```
> Asset #3202730 BTC
> Bitcoin
>
> Type: CRYPTO
> Rank: 1
> Price: 104,250.12  24h: +1.18%  7d: +4.03%
> Market cap: $2,071,000,000,000.00  Volume 24h: $48,900,000,000.00
>
> Crypto metadata:
> Categories: Layer 1, Store of Value
> Website: https://bitcoin.org
> Description: Bitcoin is a decentralized digital asset used as a settlement and store-of-value network.
> ```

## Scanning Asset Lists

If you do not have a specific asset in mind, ask for a list first:

> Show me the top crypto assets by market cap, limit 5.

> **Execution Result**
>
> ```
> Assets CRYPTO (5 of 18421)
> Page: 1  Limit: 5
>
> ID       Symbol  Type    Market  Rank  Price       24h     MCap                  Name
> ----------------------------------------------------------------------------------------
> 3202730  BTC     CRYPTO  -       1     104,250.12  +1.18%  $2,071,000,000,000.00 Bitcoin
> 3202731  ETH     CRYPTO  -       2     3,720.44    +2.40%  $448,010,000,000.00   Ethereum
> 3202732  USDT    CRYPTO  -       3     1.0001      +0.01%  $118,204,000,000.00   Tether
> 3202733  BNB     CRYPTO  -       4     684.20      +0.64%  $99,102,000,000.00    BNB
> 3202734  SOL     CRYPTO  -       5     184.72      +3.91%  $85,904,000,000.00    Solana
> ```

You can use the same pattern for stocks, ETFs, forex, and commodities:

> Show me the top US stocks in the asset database by market cap.

> Show me the largest ETFs by market cap.

> Show me commodity assets sorted by 24 hour volume.

## Reading Candles and Exchange Coverage

After you have an asset id, ask for candles:

> Show recent one-hour candles for asset 3202730.

> **Execution Result**
>
> ```
> Asset klines
> Path: /api/assets/3202730/klines
> Interval: H1  Rows: 10
>
> Time              Open       High       Low        Close      Volume
> ---------------------------------------------------------------------
> 2026-05-07 03:00  103,820.0  104,190.0  103,612.0  104,050.0  812,440.12
> 2026-05-07 04:00  104,050.0  104,320.0  103,990.0  104,210.0  695,108.90
> 2026-05-07 05:00  104,210.0  104,510.0  104,060.0  104,250.1  721,904.34
> ```

If you want to know where the asset trades, ask for exchange pairs:

> Show exchange pairs for asset 3202730 across spot and perp venues.

> **Execution Result**
>
> ```
> Asset pairs (4)
> Page: 1  Limit: 100
> Has next: no
>
> Exchange     Venue  Type  Pair      Price       Vol 24h             Bid        Ask        Funding  OI
> ---------------------------------------------------------------------------------------------------------
> BINANCE      CEX    SPOT  BTCUSDT   104,250.10  $18,400,000,000.00  104,250.0  104,250.2  -        -
> HYPERLIQUID  DEX    PERP  BTC-USD   104,248.00  $3,582,906,832.68   104,247.5  104,248.5  +0.01%   $1,859,662,464.26
> COINBASE     CEX    SPOT  BTC-USD   104,251.00  $4,209,000,000.00   104,250.8  104,251.2  -        -
> OKX          CEX    PERP  BTC-USDT  104,249.50  $2,121,000,000.00   104,249.0  104,250.0  +0.01%   $942,100,000.00
> ```

## Looking at RWA Assets and SEC Filings

For real-world asset coverage, ask directly:

> Show me the top RWA assets.

> **Execution Result**
>
> ```
> RWA assets (5 of 126)
> Page: 1  Limit: 5
>
> Rank  Symbol  Name                RWA Px    Token Px  Change  MCap               Volume             Linked
> ------------------------------------------------------------------------------------------------------------
> 1     XAU     Gold                3,374.20  3,372.90  +0.42%  $22,900,000,000.00 $812,000,000.00    PAXG
> 2     USOIL   Crude Oil           79.12     79.08     -0.31%  $1,204,000,000.00  $248,000,000.00    -
> 3     TBILL   US Treasury Bills   100.01    99.98     +0.01%  $920,000,000.00    $62,000,000.00     -
> ```

For stock-style research, search first, then ask for filings:

> Find Apple in the dPro asset database.

> Show recent SEC filings for the Apple asset from that result.

> **Execution Result**
>
> ```
> SEC filings (3 of 188)
> Page: 1  Limit: 20
>
> Form  Filing Date       Accession             Description                         URL
> ----------------------------------------------------------------------------------------
> 10-Q  2026-05-01 00:00  0000320193-26-000042  Quarterly report                    yes
> 8-K   2026-04-24 00:00  0000320193-26-000038  Current report                      yes
> 10-K  2025-11-01 00:00  0000320193-25-000123  Annual report                       yes
> ```

## Checking Global Context

When you want a broad snapshot, ask for global stats:

> Show global asset market stats.

> **Execution Result**
>
> ```
> Asset global stats
> Total market cap: $3,441,902,000,000.00
> Total volume 24h: $184,210,000,000.00
> BTC dominance: +60.22%
> ETH dominance: +13.01%
> Fear/greed: 72 Greed
> Active cryptos: 18,421
> Snapshot: 2026-05-07 10:00
> ```

## Recommended Usage Order

When using asset research for the first time, follow this order:

1. Find the asset by ticker or name.
2. Open the asset profile from the result id.
3. Check a ranked list for the same asset type.
4. Read recent candles for the asset id.
5. Check exchange pairs and venue coverage.
6. If the asset is stock-style, check recent SEC filings.
7. If you want macro context, check RWA rows and global stats.

The benefit of this approach is straightforward:
- First identify the exact asset record.
- Then inspect the metadata and market context.
- Then check price history and where it trades.
- Finally decide whether it deserves deeper market, account, or onchain research.

## What You'll Get

After going through this tutorial, you should understand how to ask asset-research questions without needing account credentials or wallet setup.

This part of the skill is read-only. It is useful before trading because it helps you avoid mixing up different symbols, asset ids, and market namespaces.

## A Reminder When Using

Asset ids are not the same thing as tradable Hyperliquid symbols. For example, a generic asset database record, a spot ticker, a perp ticker, and a HIP-3 namespaced symbol can represent different things.

If you only know a ticker, ask the agent to search first. If you already know the asset id, ask the agent to open that exact asset id.

## What's Next

If you want to monitor a wallet after researching assets, continue to [Tutorial 2: Adding Addresses to Your Account List](tutorial-02-account-radar.md). If you want deeper read-only market structure, continue to [Tutorial 3: Reading Onchain Distribution](tutorial-03-onchain-reads.md).
