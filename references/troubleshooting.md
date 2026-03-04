# Troubleshooting Reference

Use this guide as: **symptom -> likely cause -> direct fix**.

---

## `Error [ASSET_NOT_FOUND]`

**Likely cause**
- symbol not present in current market snapshot
- strict mismatch (`AAPL` vs `xyz:AAPL`)

**Fix**
1. Run `hl markets ls`
2. Copy exact `coin` value
3. Retry with exact symbol

---

## `Error [INPUT_ERROR]: Master password required...`

**Likely cause**
- encrypted API key requires password for decrypt

**Fix**
1. Pass runtime context password
2. Or pass `--password` in command call

---

## `Error [PRIVATE_KEY_MISSING]` or read-only trade failure

**Likely cause**
- attempted write action with read-only account

**Fix**
1. Add API account:
   `hl account add-api <masterAddress> <agentPrivKey> [alias]`
2. Set default account if needed:
   `hl account set-default <alias>`
3. Retry command

---

## `Error [INPUT_ERROR]: No mid price available for <coin>`

**Likely cause**
- no usable mid in response path for requested coin

**Fix**
1. Validate symbol via `hl markets ls`
2. Retry exact symbol
3. For namespaced onchain perps, use normalized namespace form

---

## `Order rejected: Order has invalid price`

**Likely cause**
- invalid wire-format price after normalization

**Fix**
1. Try market path with explicit slippage (`--slippage`)
2. Or use a valid tick-aligned limit price

---

## `Cannot set leverage on spot markets`

**Likely cause**
- leverage/margin command called on spot symbol

**Fix**
- run these commands only on perps (including HIP-3 perps)

---

## `Error [NETWORK_ERROR]`

**Likely cause**
- timeout, DNS/connectivity issue, or upstream outage

**Fix**
1. Retry once
2. Check endpoint health (`hl onchain health` or upstream status)
3. Re-run with `--json` for raw details
