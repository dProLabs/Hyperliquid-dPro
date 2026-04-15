# Tutorial 3: Reading Onchain Distribution

This is for people who already know how to read the market and check accounts.

The first two tutorials address "what's the market like now" and "what is a specific account doing". This tutorial addresses another question: can onchain data help you judge the current market state more quickly?

## What You Can Do

You can ask the agent to check:
- If the onchain service is healthy
- Mids for the entire market
- Holder distribution for a specific coin
- Position distribution for a specific perpetual
- Address tag metadata
- Order distribution for a specific coin (book / untriggered / chart)
- Liquidation heatmap
- Liquidation timeline snapshots
- Trending markets
- Leaderboard

## How to Start

First, take a look at the overall market price view:

> Check all market mids

Then you can start looking at more specific data:

> Check PURR top 5 holder addresses
> Check xyz:NVDA perp holder addresses top 5, sorted by size descending
> Check xyz:TSLA liquidation heatmap
> Check BTC order book distribution top 20
> Check BTC order chart using book source
> Check 1h all-market trending
> Check leaderboard top 10, sorted by daily PnL

## Recommended Usage Order

1. Check all market mids
2. Check PURR top 5 holder addresses
3. Check spot holder count statistics
4. Check xyz:NVDA perp holder addresses top 5, sorted by size descending
5. Check xyz:TSLA liquidation heatmap
6. Check BTC order book distribution top 20
7. Check BTC order chart using book source
8. Check 1h all-market trending
9. Check leaderboard top 10, sorted by daily PnL

### Execution Log

**Step 1: Check All Market Mids**

> **Execution Result**
>
> ```
> Onchain mids (530)
>
> Coin  Mid
> ────────────────
> 0G        0.5736
> 2Z       0.07682
> @1       12.2835
> @10   0.00003192
> @100    0.003372
> @101      0.1295
> @102     0.01378
> @103  0.00002750
> @104     0.01043
> @105      0.2488
> ... (530 coins in total)
> ```

---

**Step 2: Check PURR Top 5 Holder Addresses**

> **Execution Result**
>
> ```
> Onchain spot holders
> Path: /api/v1/hl/spot/holders
>
> Address                                     Amount          Rank
> ────────────────────────────────────────────────────────────────
> 0x2000000000000000000000000000000000000001  91710882.62793  1
> 0xffffffffffffffffffffffffffffffffffffffff  84191746.77325  2
> 0x7ea90af38397575a372e36bdc0f5970fb512fc7f  33638812.09753  3
> 0xa9ff08af55b24bb5d064d776a078e8a292b8dfe2  18500000.41998  4
> 0x0d21f939c96a13ccb9cccbf2911545d009a2e34a  18303450.15438  5
> ```

---

**Step 3: Check xyz:NVDA Perp Holder Addresses Top 5, Sorted by Size Descending**

> **Execution Result**
>
> ```
> Onchain perp holders
> Path: /api/v1/hl/perp/holders
>
> Address                                     Size        Rank
> ────────────────────────────────────────────────────────────
> 0xd8c5228c515db3043dfa0c8cd6f22450ee9a99b0  -64000.003  1
> 0x3e3868f5e6fd1b2c2b91b234436b46c0a5b1140c   45714.107  2
> 0x10761b48b1892a0fec8d808464d0c75216f6166d  -34302      3
> 0x89453000afe81a8843ae2d1c5df0f340f8800779   28568.708  4
> 0x8def9f50456c6c4e37fa5d3d57f108ed23992dae   21584.938  5
> ```

---

**Step 4: Check xyz:TSLA Liquidation Heatmap**

> **Execution Result**
>
> ```
> Onchain liquidation map
> Path: /api/v1/hl/liqmap
> Coin: xyz:TSLA
> Rows: 194
>
> Coin      Bin  Start     End       Liq Value     Positions  Segment
> ───────────────────────────────────────────────────────────────────
> xyz:TSLA    0     0.000    2.4212    358,492.43         38        4
> xyz:TSLA    1    2.4212    4.8425         53.67          3       16
> xyz:TSLA    2    4.8425    7.2637     20,938.48          4        3
> xyz:TSLA    3    7.2637    9.6850    120,333.61          3       13
> xyz:TSLA    4    9.6850   12.1062      8,838.33          3       12
> xyz:TSLA    5   12.1062   14.5274         88.78          2       12
> xyz:TSLA    6   14.5274   16.9487         11.30          1        1
> xyz:TSLA   45  108.9558  111.3770  1,266,220.95          1        6
> xyz:TSLA  115  278.4426  280.8638  1,257,535.56         11        7
> xyz:TSLA  157  380.1347  382.5559    489,105.41         43        4
> xyz:TSLA  193  467.2993  469.7206    775,346.42          7        6
> xyz:TSLA  217  525.4091  527.8303  1,042,617.02          2        7
> xyz:TSLA  227  549.6215  552.0427  1,286,843.06          4       10
> ... (194 rows in total)
> ```

---

**Step 5: Check Leaderboard Top 10, Sorted by Daily PnL**

> **Execution Result**
>
> ```
> Onchain leaderboard
> Path: /api/v1/leaderboard
>
> Rank  User                                        pnl_day
> ────────────────────────────────────────────────────────────────────────
>    1  0xa822a9ceb6d6cb5b565bd10098abcfa9cf18d748  13862229079.0843791962
>    2  0x24de6b77e8bc31c40aa452926daa6bbab7a71b0f   2190691248.6286201477
>    3  0xe6111266afdcdf0b1fe8505028cc1f7419d798a7    988002426.4712640047
>    4  0x393d0b87ed38fc779fd9611144ae649ba6082109    708777695.1622120142
>    5  0x488d2a9b70cc18ef66057a48ab3d59da1c59fe08    105666743.4105750024
>    6  0xa5b0edf6b55128e0ddae8e51ac538c3188401d41     43818723.2077110037
>    7  0xe44bd27c9f10fa2f89fdb3ab4b4f0e460da29ea8     92408649.8877550066
>    8  0x179f3d11483dafe616d56b32c4ce2562faabbbbb     83954802.4735540003
>    9  0xeadc152ac1014ace57c6b353f89adf5faffe9d55      31322485.074324999
>   10  0x85530f0ff6496c72a619f37a60f3c1a59077737f     65267650.1327719986
> ```

---

**Step 6: Check BTC Order Book Distribution Top 20**

> **Execution Result**
>
> ```
> Onchain orders (book)
> Path: /api/v1/hl/orders/book
> Coin: BTC
>
> OID           Side  Size      Price      Trigger
> ─────────────────────────────────────────────────
> 344801234001  buy   0.1200    104000.0   no
> 344801234097  sell  0.0800    104050.0   no
> ... (top 20 rows)
> ```

---

**Step 7: Check BTC Order Chart Using Book Source**

> **Execution Result**
>
> ```
> Onchain orders chart
> Path: /api/v1/hl/orders/chart
> Coin: BTC
> Type: book
> Rows: 20
> ```

---

**Step 8: Check 1h All-Market Trending**

> **Execution Result**
>
> ```
> Onchain trending (all)
> Path: /api/v1/hl/trending
> Period: 1h
>
> Market  Items  Pagination
> ─────────────────────────────
> spot      50   page=1, limit=50, total=300
> perp      50   page=1, limit=50, total=220
> ```

## What You'll Get

After completing this tutorial, you should be able to start differentiating between several types of information:
- Price itself
- Account behavior
- Onchain distribution and congestion

This way when you're watching the market, your information will be more complete, rather than just staring at single price movements.

## A Reminder When Using

For assets with namespaces, just say them the way you naturally would, for example `xyz:NVDA` or `xyz:nvda`. Don't focus on format details; getting your question out is more important.

Also note:
- `spot meta` is deprecated and now returns a warning message.
- For liquidation map, "liqmap" is the current command surface; saying "liquidation map" still works as a compatibility alias.

## What's Next

If you've understood the market, accounts, and onchain data, the next step is [Tutorial 4: Trading Desk Setup — Account Readiness, Transfers, and Order Entry](tutorial-04-trading-desk.md).
