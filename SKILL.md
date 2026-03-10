---
name: dpro-hl
description: "Use this skill for Hyperliquid and dPro workflows: market/account reads, account readiness checks, explicitly confirmed live trading, and dPro onchain analytics. Supports spot, perp, and HIP-3 assets with strict symbol matching, explicit market namespaces for trading, account resolution, preflight checks, and post-submit verification."
---

# dpro-hl

Use this skill for Hyperliquid-only workflows backed by the dPro command surface and dPro read-only onchain API.

This skill supports four domains inside one skill:

1. market reads
2. account reads and account readiness checks
3. live trading writes
4. dPro onchain read-only analytics

This file defines the **routing policy**, **execution policy**, and **safety policy**.

Do not duplicate the full command reference here.
Use the reference files for full command details:

- `references/commands.md`
- `references/onchain.md`
- `references/troubleshooting.md`

---

## When to use this skill

Use this skill when the user wants to do any of the following on Hyperliquid:

- check quotes, order books, candles, movers, overview, or supported markets
- inspect balances, positions, orders, fills, or portfolio state
- place, cancel, or manage spot / perp / HIP-3 trades
- adjust leverage or isolated margin on perp-style instruments
- query dPro onchain analytics such as mids, holders, liquidation maps, or leaderboard

Do not use this skill for:

- non-Hyperliquid exchanges
- general trading education unrelated to this repository
- unrelated programming or repository tasks

---

## Source of truth policy

Always treat the following files as the source of truth:

### `references/commands.md`
Use for:
- global flags
- canonical command syntax
- accepted input modes
- market/account/trade/onchain command examples

### `references/onchain.md`
Use for:
- fixed onchain base URL and auth rules
- endpoint mapping
- excluded paths
- HIP-3 coin normalization
- endpoint-specific response normalization rules

### `references/troubleshooting.md`
Use for:
- mapping runtime failures to likely causes
- suggesting the shortest valid fix
- deciding whether retry is safe

If this file and a reference file ever disagree, follow the reference file for command syntax and protocol details.

---

## Input model

Treat any `dpro-hl ...` string as skill input text.

Do not assume `dpro-hl` is a PATH binary unless the runtime explicitly exposes it that way.

Normalize all requests into canonical commands before execution.

Accepted user input forms include:

- canonical command form
- slash-command form
- natural-language intent

### Execution bridge
Use runtime invocation first. If unavailable, execute via Node entrypoint:

node --input-type=module -e "
  import { runHyperliquidSkill } from './scripts/entry.mjs';
  console.log(await runHyperliquidSkill('dpro-hl quote BTC'));
"
---

## Canonical command families

### Market read commands
- `dpro-hl quote <coin>`
- `dpro-hl book <coin> [--levels N]`
- `dpro-hl candles <coin> --interval <iv> [--last N]`
- `dpro-hl movers [--top N] [--side gainers|losers]`
- `dpro-hl overview [--top N]`
- `dpro-hl markets ls`

### Account management commands
- `dpro-hl account add-readonly <address> [alias]`
- `dpro-hl account add-api <masterAddress> <agentPrivKey> [alias]  --password <password>`
- `dpro-hl account ls`
- `dpro-hl account remove <alias>`
- `dpro-hl account set-default <alias>`

### Account query commands
- `dpro-hl positions [alias|address]`
- `dpro-hl balances [alias|address]`
- `dpro-hl orders [alias|address]`
- `dpro-hl fills [alias|address] [--limit N]`
- `dpro-hl portfolio [alias|address]`

### Spot trade commands
- `dpro-hl spot order limit buy|sell <size> <coin> <price> [--tif Gtc|Ioc|Alo]`
- `dpro-hl spot order market buy|sell <size> <coin> [--slippage N]`
- `dpro-hl spot order cancel <oid>`
- `dpro-hl spot order cancel-all`
- `dpro-hl spot order cancel-by-cloid <coin> <cloid>`

### Perp trade commands
- `dpro-hl perp order limit buy|sell <size> <coin> <price> [--tif Gtc|Ioc|Alo] [--reduce-only]`
- `dpro-hl perp order market buy|sell <size> <coin> [--slippage N] [--reduce-only]`
- `dpro-hl perp order cancel <oid>`
- `dpro-hl perp order cancel-all`
- `dpro-hl perp order cancel-by-cloid <coin> <cloid>`
- `dpro-hl perp order set-leverage <coin> <leverage> [--cross|--isolated]`
- `dpro-hl perp order topup-isolated <coin> <usd>`

### HIP-3 trade commands
- `dpro-hl hip3 order limit buy|sell <size> <coin> <price> [--tif Gtc|Ioc|Alo] [--reduce-only]`
- `dpro-hl hip3 order market buy|sell <size> <coin> [--slippage N] [--reduce-only]`
- `dpro-hl hip3 order cancel <oid>`
- `dpro-hl hip3 order cancel-all`
- `dpro-hl hip3 order cancel-by-cloid <coin> <cloid>`
- `dpro-hl hip3 order set-leverage <coin> <leverage> [--cross|--isolated]`
- `dpro-hl hip3 order topup-isolated <coin> <usd>`

### Builder approval command
- `dpro-hl approve-builder`

### Onchain read commands
- `dpro-hl onchain ping`
- `dpro-hl onchain health`
- `dpro-hl onchain mids`
- `dpro-hl onchain spot-meta`
- `dpro-hl onchain perps-meta`
- `dpro-hl onchain spot-holders <coin> [--page N] [--limit N]`
- `dpro-hl onchain spot-holder-counts`
- `dpro-hl onchain perp-holders <coin> [--sortBy field] [--order asc|desc] [--page N] [--limit N]`
- `dpro-hl onchain liquidation-map <coin>`
- `dpro-hl onchain leaderboard [--page N] [--limit N] [--sort field] [--order asc|desc]`

---

## Routing policy

Route each request into exactly one branch.

### 1. Market read branch
Use for:
- quote
- book
- candles
- movers
- overview
- markets listing

Examples:
- `dpro-hl quote BTC`
- `dpro-hl book ETH --levels 10`
- `dpro-hl candles SOL --interval 1h --last 20`
- `dpro-hl markets ls`

### 2. Account read / readiness branch
Use for:
- list accounts
- inspect balances
- inspect positions
- inspect orders or fills
- inspect portfolio
- check whether an API account exists before a write

Examples:
- `dpro-hl account ls`
- `dpro-hl positions`
- `dpro-hl balances main`
- `dpro-hl fills main --limit 20`

### 3. Trade write branch
Use for:
- any `spot order ...`
- any `perp order ...`
- any `hip3 order ...`
- `approve-builder`

Examples:
- `dpro-hl spot order limit buy 10 PURR 0.08`
- `dpro-hl perp order market sell 0.01 BTC --slippage 0.5`
- `dpro-hl hip3 order limit buy 1 xyz:NVDA 120`
- `dpro-hl perp order set-leverage BTC 5 --cross`

### 4. Onchain read branch
Use for:
- any `dpro-hl onchain ...` request

Examples:
- `dpro-hl onchain health`
- `dpro-hl onchain mids`
- `dpro-hl onchain spot-holders PURR --limit 5`
- `dpro-hl onchain leaderboard --limit 10`

---

Here is a clean merged English-only version that combines both sections without duplication:

```markdown
## Market-type policy

Trading must use explicit market namespaces.

### Spot
Use `dpro-hl spot ...` only for spot trading actions.

### Perp
Use `dpro-hl perp ...` only for standard perpetual trading actions.

### HIP-3
Use `dpro-hl hip3 ...` only for HIP-3 asset trading actions.

For live writes, never silently choose `spot`, `perp`, or `hip3` when the user's intent is ambiguous.

If the user gives a natural-language trade request without an explicit market namespace, apply the market namespace inference policy below.

---

## Market namespace inference policy

Use this policy only when the user gives a natural-language trade request without an explicit market namespace.

Inference hints:

- words like `spot`, `cash`, or `cash market` -> prefer `spot`
- words like `perp`, `perpetual`, `leverage`, `long`, or `short` -> prefer `perp`
- words like `HIP-3`, `stock`, `equity`, `commodity`, `index`, or namespaced symbols such as `xyz:NVDA` -> prefer `hip3`

Inference is only a routing aid.

Rules:

1. For read requests, the inferred market namespace may be used directly when the risk is low.
2. For write requests, the inferred market namespace must never be executed blindly.
3. If the market namespace is still ambiguous after inference, do not build or execute a live write command until the user clarifies or explicitly confirms the intended market type.
4. Never use inference to silently remap one market namespace into another for a live write.

Examples of ambiguous requests include:
- “buy BTC”
- “sell ETH”
- “open NVDA”

These requests are not sufficient for a live write unless the intended market type is clarified or explicitly confirmed.


## Symbol resolution policy

Symbol matching is strict.

Rules:

1. `dpro-hl markets ls` is the symbol source of truth.
2. `AAPL` and `xyz:AAPL` are different assets.
3. spot, perps, and HIP-3 are parallel modules.
4. never silently rewrite HIP-3 into spot or perp
5. for namespaced onchain perp queries, normalize as:
   - dex lowercase
   - asset uppercase

### Reads
For read requests:
- if the symbol is missing, infer only when low risk
- if multiple plausible matches exist, present candidates
- suggest `dpro-hl markets ls` when needed

### Writes
For write requests:
- exact symbol resolution is mandatory
- if exact resolution fails, stop and ask for the precise tradable symbol
- never submit a live order against an inferred but unconfirmed symbol

---

## Account resolution policy

Account resolution order:

1. explicit alias or address from the user request
2. explicit `--account` flag
3. current default / active account if the runtime exposes one
4. sole configured account, if exactly one exists
5. otherwise stop and ask the user to choose

Never guess among multiple configured accounts.

### Read path
Read operations may use:
- read-only accounts
- API accounts
- explicit addresses where supported

### Write path
Write operations require:
- an API account
- password availability
- an unambiguous target account

If account state is unknown before a write, check `dpro-hl account ls` first.

---

## Password and secret policy

If the runtime supports `runtimeContext.password`, prefer that.
Otherwise use the canonical secure command path supported by the implementation.

When password is missing for a write/decrypt flow, explicitly ask the user to provide it in one of these forms:
- `password=<YOUR_PASSWORD>` (chat/runtime input form)
- `--password <YOUR_PASSWORD>` (command form when supported)

Use a direct prompt style, for example:
- `This action needs your master password. Please provide: password=<YOUR_PASSWORD>.`

Never:
- print private keys
- print password values
- echo decrypted account material
- repeat secrets back to the user

If account setup is needed, explain the flow, but do not expose secret values in responses.

---

## Account setup policy

Only enter this flow when:
- the user requests a write action
- and `dpro-hl account ls` shows no API account is configured

Guide the user through:

1. Connect wallet and sign in to Hyperliquid: https://app.hyperliquid.xyz/join/DPRO1 
2. Open https://app.hyperliquid.xyz/API 
3. Create an API wallet 
4. add the API account through the supported secure path
5. validate readiness with:
   - `dpro-hl account ls`
   - `dpro-hl positions <alias>`

If an API account already exists:
- do not ask the user to re-add it
- request password through the supported secure path only
- continue the requested write flow

---

## Mandatory live-write safety policy

All write actions are high risk.

This includes:
- placing orders
- cancelling orders
- cancelling all orders
- cancelling by cloid
- setting leverage
- topping up isolated margin
- approving builder

For every write, execute the following state machine.

### Step 1: classify the write
Identify:
- spot order
- perp order
- hip3 order
- approve-builder

Then identify the exact sub-action:
- limit
- market
- cancel
- cancel-all
- cancel-by-cloid
- set-leverage
- topup-isolated

### Step 2: resolve prerequisites
Before any write:
- resolve exact account
- verify the account is API-capable
- confirm password is available
- resolve exact symbol
- confirm market namespace is correct

### Step 3: run preflight checks
At minimum check:
- symbol exactness
- side exactness
- size completeness
- price completeness for limit orders
- slippage completeness for market orders when applicable
- balance or margin sufficiency where applicable
- market compatibility for leverage and isolated actions

### Step 4: summarize intended effect
Before submission, summarize:
- account
- market namespace
- action
- exact symbol
- side
- size
- price or slippage
- relevant mode flags
- whether the action has persistent account effect

### Step 5: require explicit confirmation for risky actions
Require explicit confirmation before proceeding when supported by the runtime, especially for:
- market orders
- cancel-all
- high-notional orders
- leverage changes
- builder approval

### Step 6: submit using canonical command semantics
Use the canonical command model defined in this file and the synchronized command reference.

### Step 7: verify after submit
After submission:
- inspect order state if applicable
- inspect fills if applicable
- confirm success, rejection, or uncertain state

### Step 8: never blind-retry unknown writes
If the result is uncertain because of timeout or network failure:
- do not immediately re-submit
- first inspect order / fill state
- only retry if the original write clearly did not land

---

## Special write rules

### Spot orders
Use `dpro-hl spot order ...`.

Rules:
- reduce-only is not valid unless the implementation explicitly supports it for spot
- leverage and isolated margin commands are not valid on spot
- if the user asks for leverage on spot, reject and explain the mismatch

### Perp orders
Use `dpro-hl perp order ...`.

Rules:
- `set-leverage` and `topup-isolated` are valid here
- `market` uses bounded slippage / IOC-limit semantics
- `reduce-only` is valid where supported

### HIP-3 orders
Use `dpro-hl hip3 order ...`.

Rules:
- treat HIP-3 as its own trading namespace
- do not remap HIP-3 symbols into non-HIP-3 symbols
- leverage and isolated margin are valid only for HIP-3 perp-style instruments where supported
- if the target HIP-3 asset is spot-like and not perp-style, reject leverage/margin operations

### Approve builder
Treat `dpro-hl approve-builder` as a persistent account-affecting action.

Before execution, clearly state:
- that builder approval changes future account trading behavior or fee routing capability
- that the effect is not just for a single read request

Require explicit confirmation.

---

## Onchain execution policy

For any `dpro-hl onchain ...` request:

1. use only the allowlisted read-only command surface
2. follow endpoint mapping and exclusions from `references/onchain.md`
3. apply namespaced coin normalization when required
4. apply endpoint-specific response normalization when required
5. never treat excluded paths as callable through this skill

The onchain branch is read-only and requires no auth.

---

## Error handling policy

When a command fails:

1. preserve the original error
2. consult `references/troubleshooting.md`
3. translate the failure into:
   - likely cause
   - shortest direct fix
   - whether retry is safe

### Retry guidance
- symbol mismatch: do not retry until symbol is corrected
- password missing: do not retry until password is provided
- read-only account write failure: do not retry until API account is configured
- network error on reads: one retry may be acceptable
- uncertain write after network error: verify state before retry

Fail closed on writes.

---

## Output policy

Prefer concise user-facing summaries backed by structured internal results.

Preserve structured fields where available, such as:
- symbol
- marketType
- account
- side
- size
- price
- slippage
- orderId
- cloid
- status
- fill summary
- timestamp

If the user asks for raw structured data, use `--json` when supported.

---

## Natural-language normalization examples

- “Show me the latest BTC price”
  -> market read branch
  -> normalize to `dpro-hl quote BTC`

- “Check positions for my main account”
  -> account read branch
  -> normalize to `dpro-hl positions main`

- “Buy 10 PURR spot at 0.08”
  -> trade write branch
  -> normalize to `dpro-hl spot order limit buy 10 PURR 0.08`

- “Sell 0.01 BTC perp at market with 0.5 slippage”
  -> trade write branch
  -> normalize to `dpro-hl perp order market sell 0.01 BTC --slippage 0.5`

- “Buy 1 share of NVDA at 120 on HIP-3”
  -> trade write branch
  -> normalize to `dpro-hl hip3 order limit buy 1 xyz:NVDA 120`

- “Set 5x cross leverage on BTC perp”
  -> trade write branch
  -> normalize to `dpro-hl perp order set-leverage BTC 5 --cross`

- “Show me the top 5 PURR holders”
  -> onchain read branch
  -> normalize to `dpro-hl onchain spot-holders PURR --limit 5`

---

## Minimal operator checklist

Before reads:
- correct branch selected
- symbol/account resolved enough for the read

Before writes:
- API account present
- password present
- exact symbol resolved
- correct market namespace selected
- preflight checks passed
- intended effect summarized
- explicit confirmation obtained if supported
- post-submit verification performed

---

## References

- `references/commands.md`
- `references/onchain.md`
- `references/troubleshooting.md`
