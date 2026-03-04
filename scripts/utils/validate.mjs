import { inputError } from '../errors.mjs';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX_PRIVATE_KEY_RE = /^(0x)?[0-9a-fA-F]{64}$/;
const COIN_RE = /^[A-Z0-9]+(?::[A-Z0-9]+)?$/;

export function assertAddress(value, label = 'address') {
  if (!value || !ETH_ADDRESS_RE.test(value)) {
    throw inputError(`Invalid ${label}: "${value}". Must be 0x-prefixed 40-hex-char Ethereum address.`);
  }
  return value;
}

export function assertPrivateKey(value) {
  if (!value || !HEX_PRIVATE_KEY_RE.test(value)) {
    throw inputError('Invalid private key format. Must be 64 hex characters (with optional 0x prefix).');
  }
  return value.startsWith('0x') ? value.slice(2) : value;
}

export function assertCoin(value) {
  if (!value) throw inputError('Coin symbol is required.');
  const upper = value.toUpperCase();
  if (!COIN_RE.test(upper) || upper.length > 40) {
    throw inputError(`Invalid coin symbol: "${value}".`);
  }
  return upper;
}

export function assertPositiveNumber(value, label = 'value') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw inputError(`${label} must be a positive number, got: "${value}".`);
  }
  return n;
}

export function assertPositiveInteger(value, label = 'value') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw inputError(`${label} must be a positive integer, got: "${value}".`);
  }
  return n;
}

export function assertSide(value) {
  const s = String(value).toLowerCase();
  if (s !== 'buy' && s !== 'sell') {
    throw inputError(`Side must be "buy" or "sell", got: "${value}".`);
  }
  return s;
}

export function assertTif(value) {
  const tifMap = { gtc: 'Gtc', ioc: 'Ioc', alo: 'Alo' };
  const normalized = tifMap[String(value).toLowerCase()];
  if (!normalized) {
    throw inputError(`Invalid TIF: "${value}". Must be Gtc, Ioc, or Alo.`);
  }
  return normalized;
}
