import * as exchangeClient from '../clients/exchange-client.mjs';
import { resolveAccount } from '../resolvers/account-resolver.mjs';
import { getMasterPrivateKeyByAddress } from '../store.mjs';
import { assertPositiveNumber } from '../utils/validate.mjs';
import { inputError, privateKeyMissing } from '../errors.mjs';

const defaultDeps = {
  exchangeClient,
  resolveAccount,
  getMasterPrivateKeyByAddress,
};
const deps = { ...defaultDeps };

function normalizeTo(flags = {}) {
  const to = String(flags.to || 'perp').toLowerCase();
  if (to !== 'perp' && to !== 'spot') {
    throw inputError(`Invalid --to value: "${flags.to}". Must be "perp" or "spot".`);
  }
  return to;
}

async function transfer(parsed, ctx) {
  const account = deps.resolveAccount(parsed.flags?.account || null);
  if (account.mode !== 'api') {
    throw privateKeyMissing(account.alias + ' (account is read-only)');
  }

  const usd = assertPositiveNumber(parsed.args?.usd, 'USD amount');
  const to = normalizeTo(parsed.flags || {});
  const toPerp = to === 'perp';
  const from = toPerp ? 'spot' : 'perp';
  const isTestnet = ctx?.network === 'testnet';
  const masterPrivateKey = deps.getMasterPrivateKeyByAddress(account.masterAddress);

  await deps.exchangeClient.usdClassTransfer(
    String(usd),
    toPerp,
    masterPrivateKey,
    account.masterAddress,
    { isTestnet },
  );

  return {
    ok: true,
    type: 'transfer_result',
    data: { usd, from, to },
  };
}

export function __setTransferDepsForTest(overrides = {}) {
  Object.assign(deps, overrides);
}

export function __resetTransferDepsForTest() {
  Object.assign(deps, defaultDeps);
}

export default { transfer };
