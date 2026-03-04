/**
 * Per-signer monotonic nonce manager.
 * Nonce = ms timestamp, locally incremented if same-ms.
 */
const signerNonces = new Map();

export function nextNonce(signerAddress) {
  const now = Date.now();
  const key = signerAddress.toLowerCase();
  const last = signerNonces.get(key) || 0;
  const nonce = now > last ? now : last + 1;
  signerNonces.set(key, nonce);
  return nonce;
}

/**
 * Fast-forward nonce after a nonce conflict error.
 */
export function fastForwardNonce(signerAddress) {
  const key = signerAddress.toLowerCase();
  const now = Date.now();
  signerNonces.set(key, now);
  return now;
}

export function getLastNonce(signerAddress) {
  return signerNonces.get(signerAddress.toLowerCase()) || 0;
}
