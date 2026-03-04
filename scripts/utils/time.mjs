import { CANDLE_INTERVALS } from '../constants.mjs';

export function nowMs() {
  return Date.now();
}

const INTERVAL_MS = {
  '1m': 60_000,
  '3m': 3 * 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 3_600_000,
  '2h': 2 * 3_600_000,
  '4h': 4 * 3_600_000,
  '8h': 8 * 3_600_000,
  '12h': 12 * 3_600_000,
  '1d': 86_400_000,
  '3d': 3 * 86_400_000,
  '1w': 7 * 86_400_000,
  '1M': 30 * 86_400_000,
};

export function intervalToMs(interval) {
  return INTERVAL_MS[interval] || null;
}

export function isValidInterval(interval) {
  return CANDLE_INTERVALS.includes(interval);
}

/**
 * Calculate startTime for candle queries given interval and count.
 */
export function calcStartTime(interval, count) {
  const ms = intervalToMs(interval);
  if (!ms) throw new Error(`Invalid interval: ${interval}`);
  return nowMs() - ms * count;
}
