import * as store from '../store.mjs';
import * as infoClient from '../clients/info-client.mjs';
import { resolveAccount, resolveQueryAddress } from '../resolvers/account-resolver.mjs';
import { assertAddress, assertPrivateKey } from '../utils/validate.mjs';
import { inputError } from '../errors.mjs';
import { DEFAULT_FILL_LIMIT } from '../constants.mjs';

// Derive agent address from private key
async function deriveAddress(privateKeyHex) {
  const { secp256k1 } = await import('@noble/curves/secp256k1');
  const { keccak_256 } = await import('@noble/hashes/sha3');
  const keyBytes = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
  const pubKey = secp256k1.getPublicKey(keyBytes, false).slice(1); // uncompressed, strip 04 prefix
  const hash = keccak_256(pubKey);
  return '0x' + Buffer.from(hash).slice(-20).toString('hex');
}

async function addReadonly(parsed) {
  const address = parsed.target;
  if (!address) throw inputError('Usage: dpro-hl account add-readonly <address> [alias]');
  assertAddress(address, 'master address');

  const alias = parsed.args?.rest?.[0] || address.slice(0, 8);
  const account = store.addReadonlyAccount(address, alias);

  return { ok: true, type: 'account-added', data: { alias: account.alias, masterAddress: account.masterAddress, mode: 'readonly' } };
}

async function addApi(parsed, ctx) {
  const masterAddress = parsed.target;
  const agentPrivateKey = parsed.args?.rest?.[0];
  const alias = parsed.args?.rest?.[1];

  if (!masterAddress || !agentPrivateKey) {
    throw inputError('Usage: dpro-hl account add-api <masterAddress> <agentPrivateKey> [alias]  --password <password>');
  }

  assertAddress(masterAddress, 'master address');
  const cleanKey = assertPrivateKey(agentPrivateKey);

  // Set master password from context if provided
  if (ctx?.password) store.setMasterPassword(ctx.password);
  if (!store.getMasterPassword()) {
    throw inputError('Master password required. Pass via runtimeContext.password or set it first.');
  }

  const agentAddress = await deriveAddress(cleanKey);
  const accountAlias = alias || masterAddress.slice(0, 8);

  const account = store.addApiAccount(masterAddress, agentAddress, cleanKey, accountAlias);

  return {
    ok: true,
    type: 'account-added',
    data: { alias: account.alias, masterAddress: account.masterAddress, agentAddress, mode: 'api' },
  };
}

async function ls() {
  const accounts = store.listAccounts();
  return { ok: true, type: 'account-ls', data: { accounts } };
}

async function remove(parsed) {
  const alias = parsed.target;
  if (!alias) throw inputError('Usage: dpro-hl account remove <alias>');
  store.removeAccount(alias);
  return { ok: true, type: 'account-removed', data: { alias } };
}

async function setDefault(parsed) {
  const alias = parsed.target;
  if (!alias) throw inputError('Usage: dpro-hl account set-default <alias>');
  store.setDefaultAccount(alias);
  return { ok: true, type: 'account-default-set', data: { alias } };
}

async function positions(parsed, ctx) {
  const address = resolveQueryAddress(parsed.target);
  const isTestnet = ctx?.network === 'testnet';
  const netOpts = { isTestnet };
  const [perpState, spotState] = await Promise.all([
    infoClient.getClearinghouseState(address, netOpts),
    infoClient.getSpotClearinghouseState(address, netOpts),
  ]);

  const positions = [];

  // Perp positions
  if (perpState?.assetPositions) {
    for (const ap of perpState.assetPositions) {
      const pos = ap.position;
      if (Number(pos.szi) === 0) continue;
      const szi = Number(pos.szi);
      positions.push({
        coin: pos.coin,
        side: szi > 0 ? 'Long' : 'Short',
        size: Math.abs(szi),
        entryPx: pos.entryPx,
        markPx: pos.positionValue ? Math.abs(Number(pos.positionValue) / szi) : null,
        unrealizedPnl: pos.unrealizedPnl,
        leverage: pos.leverage?.value || null,
        type: 'perp',
      });
    }
  }

  return { ok: true, type: 'positions', data: { positions } };
}

async function balances(parsed, ctx) {
  const address = resolveQueryAddress(parsed.target);
  const isTestnet = ctx?.network === 'testnet';
  const netOpts = { isTestnet };
  const [perpState, spotState] = await Promise.all([
    infoClient.getClearinghouseState(address, netOpts),
    infoClient.getSpotClearinghouseState(address, netOpts),
  ]);

  const data = {};

  if (perpState) {
    data.perpEquity = perpState.marginSummary?.accountValue;
    data.availableBalance = perpState.withdrawable;
  }

  if (spotState?.balances) {
    data.spotBalances = spotState.balances
      .filter(b => Number(b.total) > 0)
      .map(b => ({
        coin: b.coin,
        total: b.total,
        hold: b.hold,
      }));
  }

  return { ok: true, type: 'balances', data };
}

async function orders(parsed, ctx) {
  const address = resolveQueryAddress(parsed.target);
  const isTestnet = ctx?.network === 'testnet';
  const result = await infoClient.getOpenOrders(address, { isTestnet, dex: 'ALL_DEXS' });

  const orderList = (result || []).map(o => ({
    oid: o.oid,
    coin: o.coin,
    side: o.side === 'B' ? 'Buy' : 'Sell',
    sz: o.sz,
    limitPx: o.limitPx,
    orderType: o.orderType,
  }));

  return { ok: true, type: 'orders', data: { orders: orderList } };
}

async function fills(parsed, ctx) {
  const address = resolveQueryAddress(parsed.target);
  const limit = Number(parsed.flags?.limit) || DEFAULT_FILL_LIMIT;
  const isTestnet = ctx?.network === 'testnet';

  const result = await infoClient.getUserFills(address, true, { isTestnet });
  const fillList = (result || []).slice(0, limit).map(f => ({
    time: f.time,
    coin: f.coin,
    side: f.side === 'B' ? 'Buy' : 'Sell',
    sz: f.sz,
    px: f.px,
    fee: f.fee,
    oid: f.oid,
  }));

  return { ok: true, type: 'fills', data: { fills: fillList } };
}

async function portfolio(parsed, ctx) {
  const address = resolveQueryAddress(parsed.target);
  const [posResult, balResult, ordResult] = await Promise.all([
    positions(parsed, ctx),
    balances(parsed, ctx),
    orders(parsed, ctx),
  ]);

  // Combine into a portfolio view — reuse the balances format with extras
  const data = {
    ...balResult.data,
    positions: posResult.data.positions,
    openOrderCount: ordResult.data.orders.length,
  };

  return { ok: true, type: 'balances', data };
}

export default {
  addReadonly, addApi, ls, remove, setDefault,
  positions, balances, orders, fills, portfolio,
};
