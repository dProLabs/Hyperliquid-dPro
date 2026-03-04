import { randomBytes } from 'node:crypto';

/**
 * Generate a 128-bit hex cloid (client order ID).
 * Format: 0x + 32 hex chars
 */
export function generateCloid() {
  return '0x' + randomBytes(16).toString('hex');
}
