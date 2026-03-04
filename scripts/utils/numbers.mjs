/**
 * Convert a float to wire format string.
 * Hyperliquid requires price/size as string with up to 5 significant figures
 * and specific formatting rules.
 */
export function floatToWire(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) throw new Error(`Invalid number: ${n}`);

  // Round to 8 decimal places to avoid floating point issues
  const rounded = Math.round(num * 1e8) / 1e8;

  // Convert to string, strip trailing zeros after decimal
  let s = rounded.toFixed(8);
  if (s.includes('.')) {
    s = s.replace(/0+$/, '').replace(/\.$/, '');
  }
  return s;
}

/**
 * Convert price for limit orders — up to 5 significant figures,
 * rounded to tick size if provided.
 */
export function priceToWire(price, tickSize) {
  let p = Number(price);
  if (!Number.isFinite(p)) throw new Error(`Invalid number: ${price}`);

  if (tickSize) {
    const tick = Number(tickSize);
    p = Math.round(p / tick) * tick;
    return floatToWire(p);
  }

  // Hyperliquid expects compact price precision (commonly <= 5 significant figures).
  if (p !== 0) {
    const magnitude = Math.floor(Math.log10(Math.abs(p)));
    const scale = Math.pow(10, 4 - magnitude); // 5 sig figs
    p = Math.round(p * scale) / scale;
  }

  return floatToWire(p);
}

/**
 * Convert size for orders — up to szDecimals precision.
 */
export function sizeToWire(size, szDecimals) {
  const s = Number(size);
  const dec = szDecimals != null ? Number(szDecimals) : 8;
  const factor = Math.pow(10, dec);
  const rounded = Math.round(s * factor) / factor;
  return floatToWire(rounded);
}
