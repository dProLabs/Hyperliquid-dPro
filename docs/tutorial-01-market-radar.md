# Tutorial 1: Learning to Read the Market First

This is for people using this skill for the first time.

If you're not ready to manage accounts or place orders yet, the best starting point is to observe the market first. This way you can get familiar with how the agent responds before gradually moving on to the later features.

## What You Can Do

You can use natural language to ask the agent to check:
- Current price of a coin
- Order book depth
- Candlestick data over a period of time
- Top gainers/losers
- Simple market overview

## How to Start

Start with the simplest phrase:

> Check BTC quote

> **Execution Result**
>
> ```
> BTC
> Mid: —
> Funding: -0.00%
> OI: $26,015.58
> Mark: 71,291.00
> Oracle: 71,331.00
> Vol 24h: $3,582,906,832.68
> ```

If you want to see the order book, you can continue:

> Check ETH order book, 5 levels deep

> **Execution Result**
>
> ```
> ETH Order Book (Top 5)
>
> Asks
>   2,078.10  x  158.0232
>   2,078.00  x   30.4648
>   2,077.90  x   13.6017
>   2,077.80  x    5.5098
>   2,077.70  x    8.9665
>
> Bids
>   2,077.60  x  352.6510
>   2,077.50  x  129.4749
>   2,077.40  x   78.1682
>   2,077.30  x  167.0017
>   2,077.20  x  189.5415
>
> Spread: 0.1000
> ```

If you want to see recent price action:

> Check SOL 1h candles, last 10

> **Execution Result**
>
> ```
> SOL 1h Candles (11)
>
> Time              Open     High     Low      Close    Volume
> ────────────────────────────────────────────────────────────────
> 2026-03-10 07:00  86.3020  86.8530  86.1570  86.6630  127,591.83
> 2026-03-10 08:00  86.6710  87.3590  86.5600  86.6600  256,065.01
> 2026-03-10 09:00  86.6580  87.4230  86.6040  87.1920  132,434.51
> 2026-03-10 10:00  87.1840  87.6590  86.7700  87.0550  123,919.64
> 2026-03-10 11:00  87.0560  87.1270  86.5900  86.7580  109,070.09
> 2026-03-10 12:00  86.7630  86.8060  86.2550  86.6430   71,920.84
> 2026-03-10 13:00  86.6560  87.2540  85.7300  86.0330  138,346.53
> 2026-03-10 14:00  86.0340  88.1760  84.8720  88.0610  421,905.68
> 2026-03-10 15:00  88.0600  88.5710  87.2540  88.3160  202,048.91
> 2026-03-10 16:00  88.3170  88.6770  87.6500  88.3630  242,754.65
> 2026-03-10 17:00  88.3620  88.7820  88.2820  88.5430   13,932.80
> ```

If you're not interested in a specific coin right now and want to scan the entire market:

> Check top 5 gainers

> **Execution Result**
>
> ```
> Top 4 Movers
>
> Coin          Price    24h Change
> ─────────────────────────────────
> BSV           15.3760     +17.76%
> RENDER         1.5800     +14.45%
> xyz:CL        79.6670     -16.09%
> xyz:BRENTOIL  83.0210     -16.01%
> ```

Or:

> Market overview top 3

> **Execution Result**
>
> ```
> Market Overview
>
> Top Gainers
>   BSV: 15.3830 +17.81%
>   RENDER: 1.5815 +14.56%
>   xyz:USAR: 20.7830 +14.20%
>   BOME: 0.0004530 +13.25%
>   xyz:SKHX: 667.0800 +12.20%
>
> Top Losers
>   xyz:CL: 80.0290 -15.71%
>   xyz:BRENTOIL: 83.3320 -15.70%
>   flx:OIL: 79.3500 -14.71%
>   km:USOIL: 98.2300 -14.35%
>   BANANA: 4.5613 -3.81%
>
> High Funding
>   PURR: +0.11%
>   xyz:SKHX: +0.10%
>   xyz:SMSN: +0.05%
>   xyz:HYUNDAI: +0.04%
>   BLAST: -0.04%
>
> Large OI
>   BTC: $1,859,662,464.26
>   ETH: $1,235,683,050.75
>   HYPE: $610,870,910.34
>   SOL: $286,648,808.93
>   xyz:CL: $186,078,923.41
> ```

## Recommended Usage Order

When using this for the first time, follow this order:

1. Check BTC quote
2. Check ETH order book, 5 levels deep
3. Check SOL 1h candles, last 10
4. Check top 5 gainers
5. Market overview top 3

The benefits of this approach are straightforward:
- First check a single coin's price
- Then check if the order book is active
- Then check if there's trend continuation
- Finally check if the overall market has a clear direction

## What You'll Get

After going through the example commands in this tutorial, you should build a basic understanding:

This skill is perfect for quickly scanning the market without having to switch between multiple pages yourself.

## What's Next

If you want to monitor a specific account next, checking its positions, balances, and trades, continue to [Tutorial 2: Adding Addresses to Your Account List](tutorial-02-account-radar.md).
