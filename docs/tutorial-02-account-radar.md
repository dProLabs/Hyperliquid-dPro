# Tutorial 2: Adding Addresses to Your Account List

This is for people who want to observe a public address.

You don't need to add your own trading account right away. Many times, it's easier to understand how this skill works by first adding a public address to your account list and checking its positions, balances, open orders, and recent trades.

## What You Can Do

You can add a public address as a readonly account, then continue to ask:
- What positions does this account currently have
- What is the account balance
- Are there any open orders
- What are the recent trades
- What are the recent order-history updates
- What are the recent funding-history updates

## How to Start

First, add a readonly account:

> Add readonly account 0xecb63caa47c7c4e77f60f1ce858cf28dc2b82b00 whale-1

After adding, you can continue to ask about this alias:

> Check whale-1 positions
> Check whale-1 balances
> Check whale-1 orders
> Check whale-1 recent 5 trades
> Check whale-1 recent 20 order-history rows
> Check whale-1 funding-history for the last 24 hours

If you'll be checking this account regularly, you can also say:

> Set whale-1 as default account

This way you can ask more simply later:

> Check positions
> Check balances
> Check orders

## Recommended Usage Order

1. List accounts
2. Add readonly account 0xecb63caa47c7c4e77f60f1ce858cf28dc2b82b00 whale-1
3. Check whale-1 positions
4. Check whale-1 balances
5. Check whale-1 orders
6. Check whale-1 recent 5 trades
7. Check whale-1 recent 20 order-history rows
8. Check whale-1 funding-history for the last 24 hours
9. Set whale-1 as default account
10. Check positions

### Execution Log

**Step 1: List Accounts**

> **Execution Result**
>
> ```
> Accounts (2)
>
> Alias         MasterAddress  AgentAddress   Mode  MasterKey  Default
> ────────────────────────────────────────────────────────────────────
> skill-test    0x87e963dE...  0x3fa5552c...  api   no
> api-transfer  0x3c34fAe5...  0x1fe2539e...  api   no
> ```

---

**Step 2: Add Readonly Account, Alias whale-1**

> **Execution Result**
>
> ```
> Account "whale-1" added (readonly, 0xecb63caa...)
> ```

---

**Step 3: Check whale-1 Positions**

> **Execution Result**
>
> ```
> Coin          Side   Size              Entry      Mark       uPnL          Leverage
> ───────────────────────────────────────────────────────────────────────────────────
> BTC           Long           292.2556  70,901.60  70,746.00   $-45,495.06        20
> ETH           Short       15,664.4221   2,015.13   2,062.10  $-735,642.17        15
> ATOM          Short       12,379.5200     1.7748     1.8292      $-672.93         5
> SOL           Short       69,227.9300    85.6325    87.8090  $-150,673.51        20
> AVAX          Short       25,981.2900    9.1674     9.8661   $-18,152.39        10
> BNB           Short        1,065.5550   630.2120   645.1300   $-15,895.81         5
> LTC           Short        1,820.1000    53.6765    54.4440    $-1,396.82        10
> ARB           Long       946,164.1000    0.09993     0.1001       $111.83        10
> DOGE          Short   16,139,049.0000    0.09296    0.09831   $-86,210.42        10
> LINK          Short      165,037.8000    11.3352     9.0805   $372,112.08        10
> ENA           Short   12,950,633.0000     0.1790     0.1049   $959,774.77         5
> FARTCOIN      Short    8,306,531.9000     0.1967     0.1574   $326,374.94         3
> HYPE          Short       31,936.1200    34.1994    34.0800     $3,815.89         3
> TRUMP         Short       32,046.9000    3.0770     2.9028     $5,582.36        10
> xyz:TSLA      Long            62.4890   403.0690   401.6800       $-86.81         3
> xyz:GOLD      Short            7.2611   5,229.63   5,228.60         $7.52         3
> cash:USA500   Short            0.3960   6,827.85   6,824.71         $1.24         3
> ... (90+ positions in total, middle part omitted)
> ```

---

**Step 4: Check whale-1 Balances**

> **Execution Result**
>
> ```
> Perp Account Equity: $33,140,728.35
> Available Balance: $15,133,961.09
>
> Spot Balances
>   USDC: 11,136,115.7479 (hold: 8,928,001.7881)
>   HYPE: 73,682.7175 (hold: 16,803.3400)
>   UBTC: 116.0283 (hold: 40.2781)
>   UETH: 2,161.6933 (hold: 1,270.2041)
>   USOL: 10,731.7288 (hold: 4,063.3380)
>   USDT0: 1,563,526.9266 (hold: 1,280,037.3004)
>   UFART: 1,182,510.1614 (hold: 954,520.2000)
>   UPUMP: 58,545,903.6991 (hold: 55,329,736.0000)
>   UBONK: 29,875,763,399.6970 (hold: 7,289,943,538.0000)
>   UENA: 521,296.3510 (hold: 411,805.0000)
>   UXPL: 4,059,754.3749 (hold: 1,428,515.5000)
>   USDH: 2,282,588.5585 (hold: 2,167,309.1943)
> ... (36 Spot assets in total, partial omitted)
> ```

---

**Step 5: Check whale-1 Orders**

> **Execution Result**
>
> ```
> OID           Coin   Side  Size          Price      Type
> ──────────────────────────────────────────────────────────
> 344643449336  BTC    Buy         7.0649   70,761.00  —
> 344643448960  SOL    Buy        66.2500      87.9080  —
> 344643448173  ETH    Buy       121.3122   2,060.40   —
> 344643448172  ETH    Sell      120.9297   2,067.10   —
> 344643447989  AIXBT  Buy    39,420.0000      0.02536 —
> 344643447988  AIXBT  Sell   19,643.0000      0.02545 —
> 344643444390  HYPE   Sell       86.5800   34.6470  —
> 344643444389  HYPE   Sell       87.5500   34.2660  —
> 344643444388  HYPE   Buy        88.4400   33.9210  —
> 344643441784  FARTCOIN Buy  64,207.1000       0.1557 —
> 344643431788  BTC    Sell       34.2702   72,939.00  —
> 344643294779  kPEPE  Sell  7,288,488.0000    0.003430 —
> ... (300+ open orders in total, middle part omitted)
> ```

---

**Step 6: Check whale-1 Recent 5 Trades**

> **Execution Result**
>
> ```
> Time                 Coin         Side  Size     Price      Fee
> ──────────────────────────────────────────────────────────────────
> 2026-03-10 17:37:17  xyz:XYZ100   Buy    0.0199  25,092.00  $-0.00
> 2026-03-10 17:37:16  xyz:XYZ100   Buy    0.0199  25,092.00  $-0.00
> 2026-03-10 17:37:16  TIA          Sell  62.6000     0.3346  $-0.00
> 2026-03-10 17:37:16  cash:USA500  Buy    0.0070   6,821.20  $-0.00
> 2026-03-10 17:37:16  cash:USA500  Buy    0.0070   6,821.20  $-0.00
> ```

---

**New: Check Order History (Natural Language)**

You can directly say:

> Help me check whale-1 recent 20 order-history rows, newest first.

> **Execution Result (example)**
>
> ```
> Time                 OID           Coin   Side  Size     Price      Status
> ─────────────────────────────────────────────────────────────────────────────
> 2026-03-10 17:39:02  344643450001  BTC    Buy   0.0200   70,900.00  filled
> 2026-03-10 17:38:41  344643449998  ETH    Sell  1.2500    2,060.50  canceled
> ...
> ```

---

**New: Check Funding History (Natural Language)**

You can directly say:

> Help me check whale-1 funding-history for the last 24 hours, top 20 rows.

> **Execution Result (example)**
>
> ```
> Time                 Coin  USDC      SZI      Funding Rate  Hash
> ─────────────────────────────────────────────────────────────────────────
> 2026-03-10 16:00:00  BTC   $-12.30   0.0100   0.000100      0xabc12345...
> 2026-03-10 08:00:00  ETH   $8.14    -2.5000  -0.000080      0xdef98765...
> ...
> ```

---

**Step 7: Set whale-1 as Default Account**

> **Execution Result**
>
> ```
> Default account set to "whale-1".
> ```

---

**Step 8: Check Positions (Using Default Account)**

> **Execution Result**
>
> ```
> (Same as Step 3, whale-1 is the default account, result is identical)
> ```

## What You'll Get

After completing this tutorial, you should understand two things:
- An account doesn't have to be your own; it can be a public address
- Readonly accounts are perfect for observation and research; you don't need to go through the trading flow first

## What's Next

If you want to continue with onchain distribution, leaderboard, and liquidation heatmaps, see [Tutorial 3: Reading Onchain Distribution](tutorial-03-onchain-reads.md).
