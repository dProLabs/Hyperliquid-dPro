# Tutorial 4: Trading Desk Setup — Account Readiness, Transfers, and Order Entry

This is for people who have finished the first 3 tutorials and are ready to start trading for the first time.

This tutorial addresses only one thing: what should you confirm before starting to trade, when you need to transfer funds, and how to express your orders.

It doesn't cover trading strategies or answer questions like "should I buy now". The focus here is on the operation sequence.

## Remember One Main Line First

Before starting to trade, just remember these 3 steps:
- First confirm you have a tradable account
- If you need to move funds between `spot` and `perp`, do the transfer
- Finally decide whether you want to do `spot`, `perp`, or `hip-3` trading

If you remember this main line first, every subsequent step will be easier to understand.

## Step 1: First Confirm You Have a Tradable Account

If you don't have an API account yet, go to Hyperliquid to create an API wallet first, then add it to this skill.

You need to prepare 4 pieces of information:
- Master wallet address
- API wallet private key
- The alias you want to use
- `api-wallet password`

If you're using the agent through conversation, you can say directly:

> Please help me add an API account. The master wallet address is \<master wallet address\>, the API wallet private key is \<API wallet private key\>, the alias is \<alias\>, and I will provide the api-wallet password.

This step only needs to be done once. After that, you can continue to confirm whether this account can actually be used for trading.

## A Security Point You Need to Know

Just know these 3 things before starting:
- Private keys are stored locally, not in plain text
- API wallet and Master wallet private keys are stored separately with encryption
- Before actually executing an action, you still need to provide the corresponding password to decrypt

Think of it this way: account information can be saved first, but when actually using the private key, there is still a local password protection layer.

## Step 2: First Confirm Whether the Account Can Trade

Before starting to trade, confirm these things:
- You already have an API account
- This account is a tradable account, not a readonly account
- If you're preparing to do fund transfers, the account's `MasterKey` should be `yes`

If you want to check the account status first, you can say:

> List accounts and check if there is an API account.

### Execution Log

**Step 1: List Accounts and Check if There Is an API Account**

> **Execution Result**
>
> ```
> Accounts (3)
>
> Alias         MasterAddress  AgentAddress   Mode      MasterKey  Default
> ────────────────────────────────────────────────────────────────────────
> skill-test    0x87e963dE...  0x3fa5552c...  api       no
> api-transfer  0x3c34fAe5...  0x1fe2539e...  api       no
> whale-1       0xecb63caa...  —              readonly  no         *
> ```

---

**Step 2: Help Me Confirm Whether This Account Can Trade**

> **Execution Result**
>
> ```
> No open positions.
> ```

---

**Step 3: If I Want to Do Transfers Between Spot and Perp, Help Me Check if This Account's MasterKey Is Already Configured**

> **Execution Result**
>
> ```
> Accounts (3)
>
> Alias         MasterAddress  AgentAddress   Mode      MasterKey  Default
> ────────────────────────────────────────────────────────────────────────
> skill-test    0x87e963dE...  0x3fa5552c...  api       no
> api-transfer  0x3c34fAe5...  0x1fe2539e...  api       no
> whale-1       0xecb63caa...  —              readonly  no         *
> ```

The `MasterKey=no` for the skill-test account indicates that the master key mapping has not been configured yet. To use the `transfer` function, you need to first configure the master wallet mapping.

So far, what you've solved is "whether I can start", not "whether I should place an order right now".

## Step 3: Only Do Spot/Perp Transfers When Needed

The transfer mentioned here is not buying or selling assets, but moving funds between the `spot` and `perp` balance buckets.

You only need this step when you're clear about transferring funds.
If you just want to check accounts, view open orders, view positions, or just get familiar with trading expressions first, you don't necessarily need to transfer first.

Confirm these 4 things before starting:
- This account is a tradable account, not a readonly account
- The `MasterKey` in the account list is `yes`
- You have already prepared the `master-wallet password`
- You have already thought through the direction and amount

The two most confusing points here are:
- `api-wallet password` cannot replace `master-wallet password`
- `MasterKey=no` means the master key mapping has not been configured yet, not a missing "master account"

You also need to think through the direction first:
- Transferring from `spot` to `perp` means funds move out of `spot` and into `perp`
- Transferring from `perp` to `spot` means funds move out of `perp` and into `spot`

Make sure to confirm the direction and amount again before executing.

If you plan to have the agent handle it through conversation, you can say:

> I want to transfer 10 USD from spot to perp. I will provide the master-wallet password. Please help me confirm the direction and amount first.

> I want to transfer 5 USD from perp back to spot. Please repeat the direction and amount first, and execute only after confirming it's correct.

## Step 4: When Starting to Trade, First Distinguish Spot, Perp, and Hip-3

Before placing orders, first distinguish which type of trading you're doing:
- If you're trading spot assets, express it as `spot`
- If you're trading perpetuals, express it as `perp`
- If you're trading HIP-3 assets, express it as `hip-3`

Both can be clearly expressed using natural language:
- Trading asset
- Buy or sell
- Amount
- Price or slippage
- Order type

### If You're Doing Perp

When doing `perp`, the usual order is:
- First set leverage
- Then decide whether to place a limit order or market order
- Have the agent repeat the order information before executing

You can say:

**Set BTC leverage to 5x cross**

> **Execution Result**
>
> ```
> Leverage set: BTC 5x cross
> ```

---

**I want to place a BTC perp limit order, buy 0.0002, price 10000. Please repeat the order information first**

> **Execution Result**
>
> ```
> Order resting: BTC buy 0.0002 @ 10,000.00 (oid: 344740330497)
> ```

---

**Please help me place an ETH perp market order, sell 0.01, slippage 0.3. Confirm direction and amount before executing**

> **Execution Result**
>
> ```
> Order filled: ETH sell 0.01 @ 2,033.43
>
> Warnings:
>   ⚠ Market order executed as IOC @ 2033.4 (mid: 2039.55, slippage: 0.3%)
> ```

### If You're Doing Spot

For spot, the key is to clearly say it's a `spot` order and include side, size, and price/slippage.

You can say:

**I want to place a spot limit order to buy 10 PURR at 0.08. Please repeat the order details first.**

> **Execution Result**
>
> ```
> Order resting: PURR buy 10 @ 0.0800 (oid: 344740827951)
> ```

### If You're Doing Hip-3

`hip-3` here is an independent market namespace (not the same as standard `spot`).
The key is to use namespaced symbols such as `xyz:NVDA`, and clearly state side, size, and price/slippage.

You can say:

**I want to buy 0.2 xyz:NVDA at price 50, place a limit order. Please confirm this is a hip-3 spot order**

> **Execution Result**
>
> ```
> Order resting: XYZ:NVDA buy 0.2 @ 50.0000 (oid: 344740827952)
> ```

---

**Please help me market buy 0.2 xyz:NVDA, slippage 0.3. First repeat the trading asset, direction, and amount**

> **Execution Result**
>
> ```
> Order filled: XYZ:NVDA buy 0.2 @ 185.0234
>
> Warnings:
>   ⚠ Market order executed as IOC @ 185.02 (mid: 184.47, slippage: 0.3%)
> ```

If you just want to get familiar with the process first, you can also continue practicing viewing open orders and canceling orders after placing an order.

**Help me check current open orders**

> **Execution Result**
>
> ```
> No open orders.
> ```

---

**Cancel order 344740330497, then help me confirm the open order list**

> **Execution Result**
>
> ```
> Cancelled order 344740330497
> ```

---

**Check open orders**

> **Execution Result**
>
> ```
> OID           Coin      Side  Size    Price    Type
> ──────────────────────────────────────────────────
> 344740827952  xyz:NVDA  Buy   0.2000  50.0000  —
> ```

## Recommended Practice Order

If you're starting to practice for the first time, you can practice in this order:

1. List accounts, confirm you have an API account
2. Confirm whether this account can trade
3. If you need to transfer, check if MasterKey is yes
4. If you need to transfer, prepare master-wallet password
5. If you need to transfer, confirm direction and amount first
6. Practice one perp trading expression first
7. Then practice one spot trading expression
8. Then practice one hip-3 trading expression
9. Finally practice viewing open orders and canceling orders

## What You'll Get

After completing this tutorial, you should be clear about three things:
- How to first determine whether you can start trading
- When you need transfer and when you don't
- How to express `spot`, `perp`, and `hip-3` trading intentions using natural language

## An Important Reminder

The agent can help you execute operations, but it won't make investment decisions for you.
Before actually executing, you still need to confirm the asset, direction, amount, price, and slippage yourself.
