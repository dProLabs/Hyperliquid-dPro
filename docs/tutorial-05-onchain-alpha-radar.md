# Tutorial 5: Finding Onchain Alpha Signals

This tutorial is for people who already know how to read prices, account state, and basic onchain distribution.

The goal here is not to place trades. The goal is to ask better read-only questions before you decide whether a market deserves more attention.

## What You Can Do

You can use natural language to ask the agent to check:
- Prediction market positions for a specific outcome
- Prediction order books and untriggered orders
- Hype TradFi assets with the highest volume
- Hype TradFi assets with the strongest gains
- Top PnL holders behind strong TradFi moves
- HIP-3 smart traders for a specific asset
- HIP-4 smart traders for a specific token

## How to Start

Start with a prediction market question:

> Show me the top holders for prediction outcome 9.

> **Execution Result**
>
> ```
> Onchain prediction positions
> Path: /api/v1/hl/prediction/positions
> Outcome: 9 Will HYPE close above the target?
> Pagination: page=1, limit=10, total=87
>
> Rank  Address                                     Side  Balance  Value   uPnL   ROE
> 1     0x91f1c8f2a8f4f9d91528a5d5e9126e4f8c4c1111  Yes   12.5000   8.75    1.40  18.20%
> 2     0x7d2c0e8cbe8e8dece6b1c2fa78c7f0b0d3a22222  No     8.0000   4.20   -0.35  -7.70%
> 3     0x21a0d13f1d1dff3d7e3afc09e6f6b89d9c333333  Yes    6.2500   4.06    0.82  25.30%
> ```

If you want to see where orders are resting for that prediction market, ask:

> Check the prediction order book for outcome 9, side 0.

> **Execution Result**
>
> ```
> Onchain prediction orders (book)
> Path: /api/v1/hl/prediction/orders/book
> Coin: #90
> Outcome: 9
> Side: 0
> Pagination: page=1, limit=20, total=46
>
> OID          Side  Size    Price   Trigger Px
> 300009001    B     40.0000 0.4820  -
> 300009002    A     15.0000 0.5150  -
> 300009003    B     22.5000 0.4700  -
> ```

When you want a broader scan, compare both sides for several outcomes:

> Compare the prediction order books for outcomes 9 and 10 on both sides.

> **Execution Result**
>
> ```
> Onchain prediction orders (book batch)
> Path: /api/v1/hl/prediction/orders/book/batch
> Requested: 4, Returned: 4, Snapshot: 52811721
>
> Coin  Outcome  Side  Orders  Pagination
> #90   9        0     46      page=1, limit=100, total=46
> #91   9        1     39      page=1, limit=100, total=39
> #100  10       0     54      page=1, limit=100, total=54
> #101  10       1     31      page=1, limit=100, total=31
> ```

## Reading Hype TradFi Momentum

For TradFi-style markets, begin with volume:

> Show me the five Hype TradFi assets with the highest 24 hour volume.

> **Execution Result**
>
> ```
> Onchain TradFi volume top
> Path: /api/v1/hl/tradfi/volume-top
> Period: 24h
>
> Coin      Name  Price    24h %   Volume        OI          MaxLev
> xyz:AMD   AMD   412.6800 19.65%  46,301,199.00 43,892,101.00 10
> xyz:TSLA  TSLA  252.1000  6.42%  39,412,884.00 31,119,552.00 10
> xyz:NVDA  NVDA  148.2400  4.81%  35,001,730.00 28,550,118.00 10
> ```

Then look for the names moving hardest:

> Which Hype TradFi names are gaining the most today?

> **Execution Result**
>
> ```
> Onchain TradFi gainers top
> Path: /api/v1/hl/tradfi/gainers-top
> Period: 24h
>
> Coin      Name  Price    24h %   Volume        OI          MaxLev
> xyz:AMD   AMD   412.6800 19.65%  46,301,199.00 43,892,101.00 10
> xyz:META  META  706.1200  8.14%  19,002,551.00 15,882,340.00 10
> xyz:TSLA  TSLA  252.1000  6.42%  39,412,884.00 31,119,552.00 10
> ```

If a move looks interesting, ask who is winning inside it:

> For the strongest Hype TradFi gainers, show the top PnL holders for each asset.

> **Execution Result**
>
> ```
> Onchain TradFi gainers holder PnL top
> Path: /api/v1/hl/tradfi/gainers-holder-pnl-top
> Period: 24h
>
> Coin      Address                                     Side  uPnL       ROE     Liq Risk
> xyz:AMD   0x742d35cc6634c0532925a3b844bc9e7595f0001  long  880,000.00 24.00%  low
> xyz:AMD   0x4bfa43fef3278d3a87f1c46ff281ab9d3f0002  long  351,220.00 15.40%  medium
> xyz:META  0x9e251a3d87e60f0234dd84bc9b2b97aef00003  long  210,118.00 11.90%  low
> ```

## Finding Smart Traders

Once you have an asset in mind, ask who has been trading it well.

For HIP-3 assets:

> Find the top smart traders for xyz:TSLA on HIP-3, sorted by PnL percentage.

> **Execution Result**
>
> ```
> Onchain HIP-3 smart traders
> Path: /api/v1/hip3/smart-trader
> Coin: xyz:TSLA
> Mark: 252.1000
> Pagination: page=1, limit=10, total=132
>
> Rank  User                                        PnL       PnL %   Buy        Sell       Portfolio  Trades  Last Trade
> 1     0xa31b4f91f3e83b9e6e0189aa0a4041f11111111  42,150.00 38.42%  110,200.00 152,350.00 9,820.00   18      2026-05-07 09:15:20
> 2     0x1c0bb6e8c2fd901f1a10df0c1d2a6a22222222  31,004.00 30.88%   85,900.00 116,904.00 6,110.00   12      2026-05-07 08:42:11
> ```

For HIP-4 tokens:

> Show smart traders for HIP-4 token 123, sorted by PnL.

> **Execution Result**
>
> ```
> Onchain HIP-4 smart traders
> Path: /api/v1/hip4/smart-trader
> Token ID: 123
> Mark: 0.7321
> Pagination: page=1, limit=10, total=58
>
> Rank  User                                        PnL      PnL %   Buy       Sell      Portfolio  Trades  Last Trade
> 1     0x8f8d7c0b7f5e4a3d2c1b00998877665544440001  8,210.00 64.11%  12,800.00 21,010.00 2,550.00   9       2026-05-07 10:02:44
> 2     0x2a6a0e7d7c67a312d1b80acdb420df0011110002  5,930.00 41.26%  14,370.00 20,300.00 1,880.00   7       2026-05-07 07:38:09
> ```

## Recommended Usage Order

When you want to look for onchain alpha signals, use this order:

1. Check which prediction outcomes have concentrated positions.
2. Check the prediction order book for the outcome and side you care about.
3. Scan Hype TradFi assets by volume.
4. Scan Hype TradFi gainers.
5. Check top PnL holders behind the strongest TradFi moves.
6. Check HIP-3 smart traders for the asset you are watching.
7. If the market is HIP-4, check smart traders by token id.

The point is to move from broad context to specific wallets:
- First identify active markets.
- Then identify order pressure.
- Then identify who is already winning.
- Finally decide whether the signal is worth deeper research.

## What You'll Get

After going through this tutorial, you should be able to ask the agent for richer read-only context before trading.

You are not just asking, "what is the price?" You are asking:
- Who is positioned?
- Where are orders resting?
- Which TradFi-style markets are active?
- Which wallets have shown strong realized performance?

## A Reminder When Using

Prediction markets often use outcome ids and side ids. If you know them, say them naturally, like "outcome 9, side 0". If you only know the market description, ask the agent to help you identify the right outcome before reading order flow.

For namespaced assets, just say them as you see them, for example `xyz:TSLA` or `xyz:tsla`. The agent will normalize the symbol for supported read-only calls.

## What's Next

If the read-only signals look interesting and you are ready to manage real orders, continue to [Tutorial 4: Trading Desk Setup](tutorial-04-trading-desk.md).
