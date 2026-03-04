import { findAccount } from '../store.mjs';
import { accountNotFound } from '../errors.mjs';

/**
 * Resolve alias/address to account info.
 * Returns { masterAddress, agentAddress?, mode, alias }
 */
export function resolveAccount(aliasOrAddress) {
  const account = findAccount(aliasOrAddress);
  if (!account) {
    throw accountNotFound(aliasOrAddress || 'default (no accounts configured)');
  }
  return account;
}

/**
 * Resolve to the address to use for info queries.
 * Always returns the masterAddress (never the agent address).
 */
export function resolveQueryAddress(aliasOrAddress) {
  const account = resolveAccount(aliasOrAddress);
  return account.masterAddress;
}
