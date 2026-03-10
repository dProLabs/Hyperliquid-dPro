# 教程 4：开始交易前要做什么

这篇适合已经看完前 3 篇，并且准备第一次开始交易的人。

这一篇只解决一件事：开始交易前，应该先确认什么、什么时候需要互转、以及下单时应该怎么说。

它不讲交易策略，也不回答“现在该不该买”这类问题。这里关注的是操作顺序。

## 先记住一条主线

开始交易前，你只要先记住这 3 步：
- 先确认自己有可交易账户
- 如果需要在 `spot` 和 `perp` 之间调资金，再做互转
- 最后再决定要做 `perp` 还是 `hip-3` 交易

如果你先把这条主线记住，后面每一步都会更容易理解。

## 第一步：先确认你有可交易账户

如果你还没有 API 账户，先去 Hyperliquid 创建一个 API wallet，再把它添加到这个 skill 里。

你需要准备 4 个信息：
- 主钱包地址
- API wallet 私钥
- 你想使用的别名
- `api-wallet password`

如果你是通过对话来使用 agent，可以直接这样说：

```text
请帮我添加 API 账户，主钱包地址是 <主钱包地址>，API wallet 私钥是 <API wallet 私钥>，别名是 <别名>，我会提供 api-wallet password。
```

这一步只需要做一次。之后你就可以继续确认这个账户能不能真正用于交易。

## 一个你需要知道的安全点

开始前知道这 3 件事就够了：
- 私钥保存在本地，不是明文保存
- API wallet 和 Master wallet 私钥是分别加密保存的
- 真正执行动作前，仍然需要提供对应的密码来解密

你可以把它理解成：账户信息可以先记住，但真正要动用私钥时，仍然有一道本地密码保护。

## 第二步：先确认账户能不能交易

开始交易前，先确认下面几件事：
- 你已经有 API 账户
- 这个账户是可交易账户，不是只读账户
- 如果你准备做资金互转，这个账户的 `MasterKey` 应该是 `yes`

如果你想先检查账户状态，可以这样说：

```text
列出账户并检查是否有 API 账户。
```

```
dpro-hl account ls --account skill-test
```

```
Accounts (3)

Alias         MasterAddress  AgentAddress   Mode      MasterKey  Default
────────────────────────────────────────────────────────────────────────
skill-test    0x87e963dE...  0x3fa5552c...  api       no                
api-transfer  0x3c34fAe5...  0x1fe2539e...  api       no                
whale-1       0xecb63caa...  —              readonly  no         *      
```

```text
帮我确认这个账户能不能交易。
```

```
dpro-hl positions skill-test
```

```
No open positions.
```

```text
如果我要做现货和合约之间的互转，帮我看一下这个账户的 MasterKey 是否已经配置好。
```

```
dpro-hl account ls
```

```
Accounts (3)

Alias         MasterAddress  AgentAddress   Mode      MasterKey  Default
────────────────────────────────────────────────────────────────────────
skill-test    0x87e963dE...  0x3fa5552c...  api       no                
api-transfer  0x3c34fAe5...  0x1fe2539e...  api       no                
whale-1       0xecb63caa...  —              readonly  no         *      
```

skill-test 账户的 `MasterKey=no`，表示还未配置 master key mapping。如需使用 `transfer` 功能，需先通过 `dpro-hl account add-master` 配置主钱包映射。

到这里为止，你先解决的是“我能不能开始”，还不是“我要不要立刻下单”。

## 第三步：只有需要时，才做 spot/perp 互转

这里说的互转，不是买卖资产，而是把资金在 `spot` 和 `perp` 两个余额桶之间调来调去。

只有在你明确要调资金时，才需要这一步。
如果你只是想看账户、看挂单、看持仓，或者只是先熟悉交易表达方式，都不一定要先互转。

开始前先确认这 4 件事：
- 这个账户是可交易账户，不是只读账户
- 账户列表里的 `MasterKey` 是 `yes`
- 你已经准备好 `master-wallet password`
- 你已经想清楚方向和金额

这里最容易混淆的两点是：
- `api-wallet password` 不能代替 `master-wallet password`
- `MasterKey=no` 表示还没有配置 master key mapping，不是缺少“主账户”

方向也要先想清楚：
- 从 `spot` 转到 `perp`，就是钱从 `spot` 出去，进入 `perp`
- 从 `perp` 转到 `spot`，就是钱从 `perp` 出去，进入 `spot`

执行前一定要再次确认方向和金额。

如果你打算通过对话让 agent 帮你处理，可以这样说：

```text
我想把 10 美元从 spot 转到 perp，我会提供 master-wallet password，请先帮我确认方向和数量。
```

```text
我想把 5 美元从 perp 转回 spot，请先复述一遍方向和金额，确认无误后再执行。
```

## 第四步：开始交易时，先分清你做的是 perp 还是 hip-3

开始下单前，先分清楚你做的是哪一类交易：
- 如果你做的是永续合约，就按 `perp` 来表达
- 如果你做的是现货交易，就按 `hip-3` 来表达

两种都可以直接用自然语言说清楚：
- 交易对象
- 买入还是卖出
- 数量
- 价格或滑点
- 订单类型

### 如果你要做 perp

做 `perp` 时，通常是这个顺序：
- 先设置杠杆
- 再决定下限价单还是市价单
- 执行前让 agent 复述一遍订单信息

你可以这样说：

```text
把 BTC 杠杆设置为 5 倍全仓。
```

```
dpro-hl perp order set-leverage BTC 5 --cross --account skill-test
```

```
Leverage set: BTC 5x cross
```

```text
我想做 BTC 的 perp 限价单，买入 0.0002，价格 10000，请先帮我复述一遍订单信息。
```

```
dpro-hl perp order limit buy 0.0002 BTC 10000 --account skill-test
```

```
Order resting: BTC buy 0.0002 @ 10,000.00 (oid: 344740330497)
```

```text
请帮我下一个 ETH 的 perp 市价单，卖出 0.01，滑点 0.3，执行前先确认方向和数量。
```

```
dpro-hl perp order market sell 0.01 ETH --slippage 0.3 --account skill-test
```

```
Order filled: ETH sell 0.01 @ 2,033.43

Warnings:
  ⚠ Market order executed as IOC @ 2033.4 (mid: 2039.55, slippage: 0.3%)
```

### 如果你要做 hip-3

`hip-3` 这里可以理解成现货交易。重点是先把交易对象、方向和数量说清楚。

你可以这样说：

```text
我想买入 0.2 个 xyz:NVDA，价格 50，做一张限价单，请先确认这是 hip-3 现货单。
```

```
dpro-hl hip3 order limit buy 0.2 xyz:NVDA 50 --account skill-test
```

```
Order resting: XYZ:NVDA buy 0.2 @ 50.0000 (oid: 344740827952)
```

```text
请帮我市价买入 0.2 个 xyz:NVDA，滑点 0.3，先复述交易对象、方向和数量。
```

```
dpro-hl hip3 order market buy 0.2 xyz:NVDA --slippage 0.3 --account skill-test
```

```
Order filled: XYZ:NVDA buy 0.2 @ 185.0234

Warnings:
  ⚠ Market order executed as IOC @ 185.02 (mid: 184.47, slippage: 0.3%)
```

如果你只是想先熟悉流程，也可以在下单之后继续练习查看挂单和撤单。

```text
帮我看一下当前挂单。
```

```
dpro-hl orders skill-test
```

```
No open orders.
```

```text
取消订单 <OID>，然后再帮我确认挂单列表。
```

```
dpro-hl orders skill-test
```

```
OID           Coin      Side  Size    Price      Type
─────────────────────────────────────────────────────
344740330497  BTC       Buy   0.0002  10,000.00  —   
344740827952  xyz:NVDA  Buy   0.2000    50.0000  —   
```

```
dpro-hl perp order cancel 344740330497 --account skill-test
```

```
Cancelled order 344740330497
```

```
dpro-hl orders skill-test
```

```
OID           Coin      Side  Size    Price    Type
───────────────────────────────────────────────────
344740827952  xyz:NVDA  Buy   0.2000  50.0000  —   
```

## 建议的练习顺序

如果你是第一次开始动手，可以按这个顺序练习：

```text
1. 列出账户，确认自己有 API 账户
2. 确认这个账户能不能交易
3. 如果你需要互转，再检查 MasterKey 是否为 yes
4. 如果你需要互转，再准备 master-wallet password
5. 如果你需要互转，先确认方向和金额
6. 先练习一句 perp 交易表达
7. 再练习一句 hip-3 交易表达
8. 最后再练习查看挂单和撤单
```

## 你会得到什么

用完这篇之后，你应该能清楚三件事：
- 怎么先判断自己能不能开始交易
- 什么时候需要 transfer，什么时候不需要
- 怎么分别用自然语言表达 `perp` 和 `hip-3` 的交易意图

## 一个重要提醒

agent 可以帮助你执行操作，但不会替你做投资决策。
真正执行前，仍然要自己确认标的、方向、数量、价格和滑点。
