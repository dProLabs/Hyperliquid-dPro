---
name: dpro-hl
description: "Use this skill for Hyperliquid and dPro workflows: market/account reads, news reads, account readiness checks, spot-perp fund transfers, explicitly confirmed live trading, and dPro onchain analytics. Supports spot, perp, and HIP-3 assets with strict symbol matching, explicit market namespaces for trading, account resolution, preflight checks, and post-submit verification."
---

# dpro-hl

Use this skill for Hyperliquid-only workflows backed by the dPro command surface, dPro news API, and dPro read-only onchain API.

This skill supports six domains inside one skill:

1. market reads
2. account reads and account readiness checks
3. fund transfers between spot and perp balance buckets
4. live trading writes
5. dPro onchain read-only analytics
6. dPro news reads

This file defines the **routing policy**, **execution policy**, and **safety policy**.

Do not duplicate the full command reference here.
Use the reference files for full command details:

- `references/commands.md`
- `references/onchain.md`
- `references/news.md`
- `references/troubleshooting.md`

---

## When to use this skill

Use this skill when the user wants to do any of the following on Hyperliquid:

- check quotes, order books, candles, movers, overview, or supported markets
- inspect latest dPro asset news by Hyperliquid-aware symbols
- inspect balances, positions, orders, fills, or portfolio state
- transfer funds between spot and perp balance buckets
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
- market/account/trade/news/onchain command examples

### `references/onchain.md`
Use for:
- fixed onchain base URL and request rules
- endpoint mapping
- excluded paths
- HIP-3 coin normalization
- endpoint-specific response normalization rules

### `references/news.md`
Use for:
- news API base URL and request rules
- news list/detail endpoint mapping
- news query parameters and response-shape handling

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

```bash
node --input-type=module -e "
  import { runHyperliquidSkill } from './scripts/entry.mjs';
  console.log(await runHyperliquidSkill('dpro-hl quote BTC'));
"
```

---

## Canonical command families

This section defines command taxonomy only, not full syntax.

For canonical command forms, flags, and exact argument shapes, always use:
- `references/commands.md`

Families:
- market reads
- account management
- account state queries
- fund transfers
- spot trade writes
- perp trade writes
- hip3 trade writes
- builder approval
- news reads
- onchain reads

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
- inspect builder authorization state
- check whether an API account exists before a write

Examples:
- `dpro-hl account ls`
- `dpro-hl positions`
- `dpro-hl balances main`
- `dpro-hl fills main --limit 20`
- `dpro-hl builder-approval main`

### 3. News read branch
Use for:
- latest news lists
- asset-filtered news by `assetSymbol`
- hot news windows
- news detail by id

Examples:
- `dpro-hl news BTC --limit 5`
- `dpro-hl news --asset xyz:AAPL --category hot-24h --locale en`
- `dpro-hl news detail 12345 --locale zh-CN`

### 4. Transfer branch
Use for:
- top-level `transfer` requests between spot and perp buckets

Examples:
- `dpro-hl transfer 10`
- `dpro-hl transfer 25 --to spot`
- `dpro-hl transfer 5 --to perp --account main`

### 5. Trade write branch
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

### 6. Onchain read branch
Use for:
- any `dpro-hl onchain ...` request

Examples:
- `dpro-hl onchain health`
- `dpro-hl onchain mids`
- `dpro-hl onchain spot-holders PURR --limit 5`
- `dpro-hl onchain orders-book BTC --page 1 --limit 20`
- `dpro-hl onchain liqmap BTC --groupBy all`
- `dpro-hl onchain trending --period 1h --market all`
- `dpro-hl onchain leaderboard --limit 10`

## News execution policy

For any `dpro-hl news ...` request:

1. use the public read-only dPro assets news API
2. do not prompt for account selection, API-wallet password, or master-wallet password
3. pass Hyperliquid-aware symbols through as `assetSymbol`; do not require `assetId`
4. consume the wrapped API response through `data`
5. use `--json` when the user asks for raw structured data

News reads are separate from `dpro-hl onchain ...` because onchain intentionally excludes news paths.

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

For `dpro-hl account ls` interpretation:
- treat `MasterAddress` as the master account address and `AgentAddress` as the API sub-account address
- if `MasterKey=no`, explain this as missing master-key mapping for the existing account, not a missing "master account" entry
- if guiding the user to fix `MasterKey=no` with `dpro-hl account add-master ...`, explicitly say this flow needs `master-wallet password` first
- request password input through `--master-password <YOUR_PASSWORD>` (or runtime `masterPassword=<YOUR_PASSWORD>`) before constructing the `add-master` command

### Write path
Write operations require:
- an API account
- password availability
- an unambiguous target account

Some write operations also require extra signer state:
- `dpro-hl transfer ...` requires a stored master key mapping for the selected account's `masterAddress`

If account state is unknown before a write, check `dpro-hl account ls` first.

---

## Password and secret policy

If the runtime supports `runtimeContext.apiPassword` / `runtimeContext.masterPassword`, prefer those.
Otherwise use the canonical secure command path supported by the implementation.

Credential split rules:
- `api-wallet password` protects API-wallet-related encrypted material used for `spot/perp/hip3 order ...` flows
- `master-wallet password` protects master-wallet-related encrypted material used for `transfer ...` and `account add-master|update-master|remove-master ...` flows
- `api-wallet password` and `master-wallet password` are separate secrets and must not be assumed interchangeable
- cached availability of one password must not be treated as availability of the other

Password session cache is enabled by default for this skill runtime:
- when user provides a specific password once, later commands in the same agent session may reuse that same credential class across new node processes
- do not repeatedly ask for password if a write can proceed with cached credentials
- users may clear cache explicitly with `dpro-hl account clear-password-cache`

When password is missing for a write/decrypt flow, explicitly ask the user to provide it in one of these forms:
- `apiPassword=<YOUR_PASSWORD>` / `masterPassword=<YOUR_PASSWORD>` (chat/runtime input form)
- `--api-password <YOUR_PASSWORD>` / `--master-password <YOUR_PASSWORD>` (command form)

Use direct prompt styles that name the credential class:
- order / API-wallet flow: `This action needs your api-wallet password. Please provide: --api-password <YOUR_PASSWORD>.`
- transfer / master-wallet flow: `This transfer needs your master-wallet password. Please provide: --master-password <YOUR_PASSWORD>.`
- master-key management flow: `This action needs your master-wallet password. Please provide: --master-password <YOUR_PASSWORD>.`

Never assume reuse across credential classes:
- if an order flow succeeded with an `api-wallet password`, still ask for `master-wallet password` before `transfer ...` unless master-password availability is explicitly known
- if a transfer flow succeeded with a `master-wallet password`, still ask for `api-wallet password` before order/decrypt flows unless API-password availability is explicitly known

For master-key management commands:
- treat `dpro-hl account add-master ...`, `update-master ...`, and `remove-master ...` as master-wallet secret-management flows
- never skip the password prompt just because the current context has no explicit password input UI
- never suggest "try `add-master` directly" before resolving `master-wallet password` input

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
- transfers between spot and perp buckets
- adding, updating, or removing master-key mappings
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
- transfer
- master-key management
- spot order
- perp order
- hip3 order
- approve-builder

Then identify the exact sub-action:
- transfer direction (`--to perp|spot`)
- master-key add
- master-key update
- master-key remove
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
- for `transfer`, confirm `master-wallet password` availability
- for `transfer`, verify master-key mapping exists for the account `masterAddress`
- for master-key management, confirm `master-wallet password` availability before suggesting or executing `add-master`, `update-master`, or `remove-master`
- for trading writes, confirm `api-wallet password` availability
- for trading writes, resolve exact symbol
- for trading writes, confirm market namespace is correct
- for trading writes, check builder approval via `maxBuilderFee` using the selected account `masterAddress`

### Step 3: run preflight checks
At minimum check:
- positive amount / size completeness
- for `transfer`, destination bucket exactness (`perp` or `spot`)
- for trading writes, symbol exactness
- for trading writes, side exactness
- price completeness for limit orders
- slippage completeness for market orders when applicable
- market compatibility for leverage and isolated actions
- for trading writes, if `maxBuilderFee > 0`, attach builder payload `{"b": <builderAddress>, "f": <fee>}`; if `maxBuilderFee = 0`, submit without builder payload

For perp / HIP-3 order writes:
- do not hard-block solely because displayed `perpEquity` is `0`
- submit the order first, then use venue rejection (`insufficient margin` / `insufficient balance`) as the funding truth signal

### Step 4: summarize intended effect
Before submission, summarize:
- account
- for `transfer`, selected account or alias, from bucket, to bucket, and USD amount
- for trading writes, market namespace
- action
- exact symbol when applicable
- side when applicable
- size when applicable
- price or slippage
- builder payload decision (`attached` vs `not attached`, with `b` and `f` when attached)
- when `maxBuilderFee = 0`, include an informational reminder: "Please log in to https://www.d.pro/ to get trading fee discounts." (plain reminder tone, not a warning)
- relevant mode flags
- whether the action has persistent account effect

### Step 5: require explicit confirmation for risky actions
Require explicit confirmation before proceeding when supported by the runtime, especially for:
- all spot<->perp transfers
- market orders
- cancel-all
- high-notional orders
- leverage changes
- builder approval

For trading writes when `maxBuilderFee = 0`:
- always present the dPro fee-discount reminder before asking for final execution confirmation
- present it as an informational reminder, not as a warning

For `transfer ...`:
- do not execute until the user explicitly confirms the direction and USD amount after the summary is shown
- this confirmation is mandatory for both `spot -> perp` and `perp -> spot` transfers

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

### Master-key management
Use:
- `dpro-hl account add-master <masterAddress> <masterPrivKey> --master-password <password>`
- `dpro-hl account update-master <masterAddress> <masterPrivKey> --master-password <password>`
- `dpro-hl account remove-master <masterAddress> --master-password <password>`

Rules:
- these commands require `master-wallet password`
- when the user needs to fix `MasterKey=no` or a `missing master key` error, ask for password input before giving or executing the repair command
- do not give only the command and omit the password requirement
- do not say "there is no password prompt here, so try `add-master` directly"
- if password is not yet available, first request `--master-password <YOUR_PASSWORD>` (or runtime `masterPassword=<YOUR_PASSWORD>`)
- only after password availability is clear should the agent continue with `add-master`, `update-master`, or `remove-master`

Master-key management example:
- `account ls` shows `MasterKey=no` for an API account
- explain that the account exists and only the master-key mapping is missing
- ask for `master-wallet password`
- then guide the user to `dpro-hl account add-master <masterAddress> <masterPrivKey> --master-password <password>`

### Transfers
Use `dpro-hl transfer <usd> [--to perp|spot]`.

Rules:
- `transfer` is a top-level command, not a `spot/perp/hip3 order` subcommand
- default destination is `perp` when `--to` is omitted
- transfer signing uses the stored master wallet private key, not the API wallet private key
- transfer requires `master-wallet password`, not `api-wallet password`
- `master-wallet password` and `api-wallet password` must be treated as independent credentials
- the selected account must still be an API-capable account; read-only accounts are invalid for transfer
- resolve master key by `masterAddress`, not by alias
- never rewrite invalid `--to` values; reject anything other than `perp` or `spot`
- before any `spot -> perp` or `perp -> spot` transfer, confirmation of both direction and USD amount is mandatory
- before execution, explicitly restate and confirm `from`, `to`, and USD amount
- do not infer approval from a previously confirmed trade, a previous password entry, or the default `--to perp`
- if `--to` was omitted, normalize to the default destination only for command construction, then explicitly present that resolved direction for confirmation before execution

Transfer safety example:
- user asks to move funds between spot and perp
- ask for `master-wallet password`
- summarize selected account, `from`, `to`, and USD amount
- ask for explicit confirmation of direction and amount
- execute only after that confirmation

### Spot orders
Use `dpro-hl spot order ...`.

Rules:
- reduce-only is not valid unless the implementation explicitly supports it for spot
- leverage and isolated margin commands are not valid on spot
- if the user asks for leverage on spot, reject and explain the mismatch
- before submit, check `maxBuilderFee` with user=`masterAddress` and builder=`BUILDER_ADDRESS`; attach `{"b": builder, "f": fee}` only when approved (`maxBuilderFee > 0`)

### Perp orders
Use `dpro-hl perp order ...`.

Rules:
- `set-leverage` and `topup-isolated` are valid here
- `market` uses bounded slippage / IOC-limit semantics
- `reduce-only` is valid where supported
- unified-account behavior: never require a pre-trade "transfer to perp" check based only on `perpEquity`; if the venue rejects for funding, return that rejection and guide the user to add collateral or reduce size
- before submit, check `maxBuilderFee` with user=`masterAddress` and builder=`BUILDER_ADDRESS`; attach `{"b": builder, "f": fee}` only when approved (`maxBuilderFee > 0`)

### HIP-3 orders
Use `dpro-hl hip3 order ...`.

Rules:
- treat HIP-3 as its own trading namespace
- do not remap HIP-3 symbols into non-HIP-3 symbols
- leverage and isolated margin are valid only for HIP-3 perp-style instruments where supported
- if the target HIP-3 asset is spot-like and not perp-style, reject leverage/margin operations
- before submit, check `maxBuilderFee` with user=`masterAddress` and builder=`BUILDER_ADDRESS`; attach `{"b": builder, "f": fee}` only when approved (`maxBuilderFee > 0`)

### Approve builder
Treat `dpro-hl approve-builder` as a persistent account-affecting action.

Use `dpro-hl builder-approval [alias|masterAddress] [--builder <builderAddress>]` to read whether a user already approved a builder.

When `builder-approval` returns `maxBuilderFee = 0`, explicitly inform the user: "Please log in to https://www.d.pro/ to get trading fee discounts." Present this as an informational reminder, not as a warning.

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

The onchain branch is read-only and requires no account credentials.

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
- newsId
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

- “Show me latest BTC news”
  -> news read branch
  -> normalize to `dpro-hl news BTC`

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
