import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ExchangeClient, HttpTransport } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';

function parseBoolEnv(value, fallback) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizePrivateKey(privateKeyHex) {
  if (!privateKeyHex) return privateKeyHex;
  return privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`;
}

function classifyFailure(message) {
  const text = String(message || '').toLowerCase();

  const authPatterns = [
    'signature',
    'signer',
    'not authorized',
    'unauthorized',
    'permission',
    'api wallet',
    'agent',
    'wallet',
    'user signed',
    'approve',
    'forbidden',
    'invalid key',
  ];
  if (authPatterns.some((p) => text.includes(p))) {
    return 'AUTH_FAIL';
  }

  const fundsPatterns = [
    'insufficient',
    'not enough',
    'balance',
    'margin',
    'collateral',
    'must deposit',
    'deposit before performing actions',
    'deposit before',
  ];
  if (fundsPatterns.some((p) => text.includes(p))) {
    return 'FUNDS_FAIL';
  }

  return 'OTHER_FAIL';
}

function compactReason(err) {
  const raw = String(err?.message || err || 'Unknown error').replace(/\s+/g, ' ').trim();
  if (!raw) return 'Unknown error';
  return raw.length > 300 ? `${raw.slice(0, 300)}...` : raw;
}

describe('live probe: usdClassTransfer signing with master wallet', () => {
  const enabled = process.env.DPRO_HL_LIVE_TRANSFER_TEST === '1';

  if (!enabled) {
    it.skip('set DPRO_HL_LIVE_TRANSFER_TEST=1 and DPRO_HL_MASTER_PRIVATE_KEY=0x... to run live probe', () => {});
    return;
  }

  it('attempts spot<->perp transfer using master-wallet signature', { timeout: 90_000 }, async (t) => {
    const privateKeyHex = normalizePrivateKey(process.env.DPRO_HL_MASTER_PRIVATE_KEY || '');
    assert.ok(privateKeyHex, 'DPRO_HL_MASTER_PRIVATE_KEY is required when DPRO_HL_LIVE_TRANSFER_TEST=1');

    const isTestnet = parseBoolEnv(process.env.DPRO_HL_LIVE_TESTNET, true);
    const amount = String(process.env.DPRO_HL_TRANSFER_AMOUNT || '1').trim();
    const to = String(process.env.DPRO_HL_TRANSFER_TO || 'perp').trim().toLowerCase();

    assert.ok(['perp', 'spot'].includes(to), 'DPRO_HL_TRANSFER_TO must be "perp" or "spot"');
    assert.ok(Number.isFinite(Number(amount)) && Number(amount) > 0, 'DPRO_HL_TRANSFER_AMOUNT must be a positive number');

    const toPerp = to === 'perp';
    const wallet = privateKeyToAccount(privateKeyHex);
    const transport = new HttpTransport({ isTestnet });
    const exchange = new ExchangeClient({ transport, wallet });

    const netLabel = isTestnet ? 'testnet' : 'mainnet';
    const direction = toPerp ? 'spot->perp' : 'perp->spot';

    try {
      const response = await exchange.usdClassTransfer({ amount, toPerp });
      const status = String(response?.status || '').toLowerCase();
      assert.equal(
        status,
        'ok',
        `classification=OTHER_FAIL network=${netLabel} direction=${direction} amount=${amount} reason=unexpected non-ok status (${status || 'empty'})`,
      );
    } catch (err) {
      const reason = compactReason(err);
      const classification = classifyFailure(reason);
      const diag = `classification=${classification} network=${netLabel} direction=${direction} amount=${amount} reason=${reason}`;

      if (classification === 'FUNDS_FAIL') {
        t.skip(`inconclusive: ${diag}. Fund transferable balance and rerun.`);
        return;
      }

      assert.fail(diag);
    }
  });
});
