# Troubleshooting Reference

Use this guide as:

**symptom -> likely cause -> shortest safe fix -> retry guidance**

This file is for runtime diagnosis only.
Use:
- `SKILL.md` for routing and execution policy
- `references/commands.md` for canonical command syntax
- `references/onchain.md` for onchain endpoint behavior

---

## How to use this file

When a command fails:

1. preserve the original error text
2. classify the failure type
3. apply the shortest direct fix
4. decide whether retry is safe
5. fail closed on live writes if state is uncertain

For write failures, never blind-retry unless you have verified that the original action did not land.

---

## Quick triage matrix

| Symptom | Likely class | First action | Retry? |
|---|---|---|---|
| `ASSET_NOT_FOUND` | symbol resolution | run `dpro-hl markets ls` and use exact coin | no, until corrected |
| `Master password required` | secret / decrypt | provide password through supported path | no, until provided |
| `PRIVATE_KEY_MISSING` | account mode | switch to API account | no, until corrected |
| `PRIVATE_KEY_MISSING ... missing master key` | transfer signer | add master key mapping for the account masterAddress | no, until corrected |
| `No mid price available` | market data / symbol mismatch | verify exact symbol | no, until corrected |
| `Order has invalid price` | pricing / tick / normalization | use valid tick price or bounded market path | only after correction |
| `Cannot set leverage on spot markets` | market-type mismatch | switch to `perp` or supported `hip3` perp | no, until corrected |
| `NETWORK_ERROR` on read | transport | retry once, then check health | yes, once |
| `spot-meta ... removed upstream` | endpoint deprecation | switch to `spot-holder-counts` / `markets ls` / `perps-meta` | no, command change required |
| timeout on write | uncertain write state | inspect orders / fills first | not until verified |

---

## Error classes

### 1. Symbol resolution errors
Use this class when the command failed because the asset key is missing, malformed, stale, or mapped to the wrong namespace.

### 2. Account / credential errors
Use this class when the command needs an API account, password, or decrypted key material and does not have it.

### 3. Market-type mismatch errors
Use this class when a spot-only, perp-only, or HIP-3-only action was attempted in the wrong namespace.

### 4. Pricing / validation errors
Use this class when the order payload is structurally valid but the price, size, or tick formatting is rejected.

### 5. Transport / upstream errors
Use this class when the request could not reliably reach the upstream service or returned an uncertain status.

---

## `Error [ASSET_NOT_FOUND]`

**Likely cause**
- symbol not present in the current market snapshot
- strict mismatch such as `AAPL` vs `xyz:AAPL`
- wrong market namespace for the intended asset
- stale copied symbol from an older snapshot

**Direct fix**
1. Run `dpro-hl markets ls`
2. Copy the exact `coin` value
3. Rebuild the command with the correct namespace:
   - `dpro-hl spot order ...` for spot
   - `dpro-hl perp order ...` for standard perps
   - `dpro-hl hip3 order ...` for HIP-3 assets
4. Retry only after the exact symbol is corrected

**Retry guidance**
- safe to retry only after the symbol is corrected
- not safe to keep retrying the same unresolved symbol

---

## `Error [INPUT_ERROR]: Master password required...`

**Likely cause**
- encrypted API key material requires password-based decrypt
- runtime did not receive the password through the supported path

**Direct fix**
1. Provide the password through `runtimeContext.apiPassword` or `runtimeContext.masterPassword` as appropriate
2. For repeated commands in separate processes, export once and reuse:
   - `export DPRO_HL_API_PASSWORD=<YOUR_API_PASSWORD>` for API-wallet operations
   - `export DPRO_HL_MASTER_PASSWORD=<YOUR_MASTER_PASSWORD>` for master-wallet operations
3. Use built-in session cache by providing password once:
   - `--api-password <YOUR_PASSWORD>` or `--master-password <YOUR_PASSWORD>`
   - cache is reused across new `node -e` processes until TTL expires
4. Otherwise use the supported secure command path such as `--api-password` / `--master-password`
5. Re-run the same command once password input is available

**Retry guidance**
- do not retry until password is provided
- ask explicitly for password input through supported form:
  - `--api-password <YOUR_PASSWORD>` or `--master-password <YOUR_PASSWORD>`
- do not echo or repeat the provided password value in responses

---

## Password is requested repeatedly even after a successful write

**Likely cause**
- session cache expired (`DPRO_HL_PASSWORD_CACHE_TTL_SEC`)
- session cache disabled (`DPRO_HL_PASSWORD_CACHE=0`)
- cache path is not writable (`DPRO_HL_PASSWORD_CACHE_FILE`)

**Direct fix**
1. Check cache env vars and remove conflicting overrides
2. Re-enter password once via `--api-password <YOUR_PASSWORD>` or `--master-password <YOUR_PASSWORD>`
3. If needed, clear stale cache and retry:
   - `dpro-hl account clear-password-cache`

**Retry guidance**
- safe to retry after cache settings are corrected
- do not print password value in logs or chat output

---

## `spot-meta` deprecation warning

**Likely cause**
- upstream `/api/v1/hl/meta/spot` endpoint was removed

**Direct fix**
1. Use one of the supported alternatives:
   - `dpro-hl onchain spot-holder-counts`
   - `dpro-hl markets ls`
   - `dpro-hl onchain perps-meta`

**Retry guidance**
- do not retry `spot-meta` for data retrieval
- switch to one of the replacement commands above

---

## `Error [PRIVATE_KEY_MISSING]` or read-only trade failure

**Likely cause**
- attempted a write action with a read-only account
- no API account is configured
- the wrong default account was selected for a write

**Direct fix**
1. Check accounts:
   - `dpro-hl account ls`
2. If no API account exists, add one through the supported secure path
   - canonical command surface may expose:
     - `dpro-hl account add-api <masterAddress> <agentPrivKey> [alias]  --api-password <password>`
3. If needed, set or choose the correct default account:
   - `dpro-hl account set-default <alias>`
4. Retry the write only after the API account is confirmed

**Retry guidance**
- do not retry on a read-only account
- safe to retry only after API account readiness is confirmed

---

## `Error [PRIVATE_KEY_MISSING] ... missing master key` on `dpro-hl transfer`

**Likely cause**
- transfer uses master-wallet signing
- selected account's `masterAddress` has no stored master key mapping

**Direct fix**
1. Check accounts:
   - `dpro-hl account ls`
2. Add master key mapping for the master address:
   - `dpro-hl account add-master <masterAddress> <masterPrivKey>  --master-password <password>`
3. Retry transfer:
   - `dpro-hl transfer <usd> [--to perp|spot] [--account <alias>]`

**Retry guidance**
- do not retry transfer until master key is configured
- after adding master key, retry is safe

---

## `Error [INPUT_ERROR]: No mid price available for <coin>`

**Likely cause**
- no usable mid was returned for the requested coin
- symbol mismatch or unsupported namespace form
- namespaced onchain perp symbol was not normalized correctly

**Direct fix**
1. Validate the symbol via `dpro-hl markets ls`
2. Retry with the exact symbol
3. For namespaced onchain perp queries, normalize to:
   - `dex` lowercase
   - `asset` uppercase
   - example: `xyz:NVDA`
4. If the error occurred during a market order flow, confirm the asset is actively quoted before retrying

**Retry guidance**
- do not retry until symbol / namespace is corrected
- if the asset is temporarily unquoted, wait for a fresh snapshot before retrying

---

## `Order rejected: Order has invalid price`

**Likely cause**
- invalid wire-format price after normalization
- limit price violates tick-size or venue formatting rules
- price was built from stale or malformed input

**Direct fix**
1. Re-check the intended market namespace and exact asset
2. Use a valid tick-aligned limit price
3. If appropriate, use the bounded market path instead:
   - `dpro-hl spot order market ... --slippage N`
   - `dpro-hl perp order market ... --slippage N`
   - `dpro-hl hip3 order market ... --slippage N`
4. Re-submit only after the price input is corrected

**Retry guidance**
- safe to retry only after price correction
- do not keep retrying the same invalid price

---

## `Cannot set leverage on spot markets`

**Likely cause**
- leverage or isolated-margin command was sent to the `spot` namespace
- the selected HIP-3 asset is not a perp-style instrument

**Direct fix**
1. Use leverage and isolated margin only with:
   - `dpro-hl perp order set-leverage ...`
   - `dpro-hl perp order topup-isolated ...`
   - `dpro-hl hip3 order set-leverage ...` for supported HIP-3 perp-style instruments
   - `dpro-hl hip3 order topup-isolated ...` for supported HIP-3 perp-style instruments
2. If the user wants spot exposure, remove leverage/margin commands entirely

**Retry guidance**
- do not retry in the `spot` namespace
- safe to retry only after switching to a supported perp-style market

---

## `Error [NETWORK_ERROR]`

**Likely cause**
- timeout
- DNS or connectivity issue
- upstream outage or degraded service

**Direct fix for reads**
1. Retry once
2. Check service health:
   - `dpro-hl onchain health`
3. Re-run with `--json` if raw details are needed

**Direct fix for writes**
1. Treat the result as uncertain until verified
2. Inspect order state and fills before doing anything else
3. Retry only if verification shows the original write did not land

**Retry guidance**
- reads: one retry is acceptable
- writes: never blind-retry after a network error

---

## Timeout or uncertain status after a write

**Likely cause**
- request may have reached the venue but the client did not receive a clean acknowledgment
- order state is unknown

**Direct fix**
1. Do not immediately re-submit
2. Inspect open orders:
   - `dpro-hl orders [alias|address]`
3. Inspect fills:
   - `dpro-hl fills [alias|address] --limit 20`
4. If using client order ids, inspect by the known cancel / lookup path where supported
5. Retry only after confirming the original write did not land

**Retry guidance**
- fail closed until state is verified
- duplicate submissions are possible if you retry too early

---

## `Order rejected: insufficient balance`, `insufficient margin`, or equivalent

**Likely cause**
- insufficient spot balance for the requested size
- insufficient perp margin for the requested notional
- isolated top-up or leverage change still leaves the account underfunded
- note: on unified accounts, `perpEquity=0` snapshots can still allow order submission; treat venue rejection as the final funding signal

**Direct fix**
1. Check balances:
   - `dpro-hl balances [alias|address]`
2. Check positions / portfolio if relevant:
   - `dpro-hl positions [alias|address]`
   - `dpro-hl portfolio [alias|address]`
3. Reduce size, add collateral, or use the correct account
4. Retry only after the account has enough balance or margin

**Retry guidance**
- do not retry unchanged
- safe to retry only after funding or size adjustment

---

## `cancel` / `cancel-by-cloid` did not find the target order

**Likely cause**
- wrong account
- wrong namespace or symbol
- stale order id / cloid
- the order already filled or was already cancelled

**Direct fix**
1. Confirm the active account:
   - `dpro-hl account ls`
2. Inspect open orders:
   - `dpro-hl orders [alias|address]`
3. For `cancel-by-cloid`, verify the exact symbol and cloid pair
4. Retry only with a confirmed live target

**Retry guidance**
- safe to retry only after the target is confirmed to exist
- if the order is already closed, do not retry cancellation

---

## `approve-builder` failed or user is unsure whether approval is needed

**Likely cause**
- builder approval not yet configured
- wrong account selected
- password missing
- user intent was unclear about persistent account effect

**Direct fix**
1. Confirm the selected API account
2. Confirm password availability
3. Re-state that builder approval is a persistent account-affecting action
4. Retry only after explicit confirmation from the user

**Retry guidance**
- do not auto-retry
- require explicit confirmation before retrying

---

## Onchain command returns empty rows or unexpected schema

**Likely cause**
- endpoint is healthy but the specific asset currently has no rows
- pagination or sort filters excluded all rows
- upstream schema variant requires normalization

**Direct fix**
1. Retry with a simpler request:
   - remove optional sort / pagination filters
2. Confirm the exact asset symbol
3. Use raw structured output when needed for inspection
4. Follow endpoint-specific normalization rules from `references/onchain.md`

**Retry guidance**
- safe to retry once with simplified parameters
- do not assume empty rows always mean failure

---

## If no exact match exists in this file

Use this fallback sequence:

1. classify the error into one of:
   - symbol resolution
   - account / credentials
   - market-type mismatch
   - pricing / validation
   - transport / upstream
2. apply the shortest direct fix
3. for writes, verify state before any retry
4. preserve the original error text in the final response

---

## Minimal troubleshooting checklist

Before retrying any failed command, confirm:
- exact symbol is correct
- market namespace is correct
- account is correct
- password is available when required
- price / slippage inputs are valid
- for writes, original state has been verified
