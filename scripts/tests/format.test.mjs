import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatResult, fmtPx, fmtNum, fmtPct, fmtUsd, renderTable } from '../format.mjs';
import { SkillError, ErrorCode } from '../errors.mjs';

describe('format helpers', () => {
  it('fmtPx formats large numbers', () => {
    assert.ok(fmtPx(91234.5).includes('91'));
  });

  it('fmtPx formats small numbers', () => {
    assert.ok(fmtPx(0.001234).includes('1234'));
  });

  it('fmtPx handles null', () => {
    assert.equal(fmtPx(null), '—');
  });

  it('fmtPct formats percentage', () => {
    assert.equal(fmtPct(0.0213), '+2.13%');
    assert.equal(fmtPct(-0.05), '-5.00%');
  });

  it('fmtUsd formats USD', () => {
    assert.ok(fmtUsd(1234.56).startsWith('$'));
  });
});

describe('renderTable', () => {
  it('renders a table with headers and rows', () => {
    const t = renderTable(['A', 'B'], [['1', '2'], ['3', '4']]);
    assert.ok(t.includes('A'));
    assert.ok(t.includes('1'));
    assert.ok(t.includes('4'));
  });
});

describe('formatResult', () => {
  it('formats quote result', () => {
    const result = {
      ok: true,
      type: 'quote',
      data: { coin: 'BTC', mid: '91234.5', change24h: 0.0213, funding: 0.0001 },
    };
    const out = formatResult(result);
    assert.ok(out.includes('BTC'));
    assert.ok(out.includes('Mid'));
    assert.ok(out.includes('2.13%'));
  });

  it('formats error result', () => {
    const err = new SkillError(ErrorCode.ASSET_NOT_FOUND, 'Asset not found: XYZ');
    const out = formatResult(err);
    assert.ok(out.includes('ASSET_NOT_FOUND'));
    assert.ok(out.includes('XYZ'));
  });

  it('formats help result', () => {
    const result = { ok: true, type: 'help', data: { message: 'test help' } };
    assert.ok(formatResult(result).includes('test help'));
  });

  it('formats JSON mode', () => {
    const result = { ok: true, type: 'quote', data: { coin: 'BTC', mid: '91234' } };
    const out = formatResult(result, 'json');
    const parsed = JSON.parse(out);
    assert.equal(parsed.data.coin, 'BTC');
  });

  it('formats account-ls empty with unified table layout', () => {
    const result = { ok: true, type: 'account-ls', data: { accounts: [] } };
    const out = formatResult(result);
    assert.ok(out.includes('Accounts (0)'));
    assert.ok(out.includes('Alias'));
    assert.ok(out.includes('Address'));
    assert.ok(out.includes('No accounts configured.'));
    assert.ok(out.includes('1. Connect wallet and sign in to Hyperliquid: https://app.hyperliquid.xyz/join/DPRO1'));
    assert.ok(out.includes('2. Create an API wallet at https://app.hyperliquid.xyz/API'));
    assert.ok(out.includes('3. Run: hl account add-api <masterAddress> <agentPrivKey> [alias]'));
    assert.ok(out.includes('4. Optional read-only mode: hl account add-readonly <address> [alias]'));
  });

  it('formats order result - resting', () => {
    const result = {
      ok: true, type: 'order_result',
      data: { status: 'resting', coin: 'BTC', side: 'buy', size: '0.01', price: '50000', oid: 123 },
    };
    const out = formatResult(result);
    assert.ok(out.includes('resting'));
    assert.ok(out.includes('123'));
  });

  it('formats order result - error', () => {
    const result = {
      ok: true, type: 'order_result',
      data: { status: 'error', error: 'Insufficient margin' },
    };
    const out = formatResult(result);
    assert.ok(out.includes('Insufficient margin'));
  });

  it('shows warnings', () => {
    const result = {
      ok: true, type: 'quote',
      data: { coin: 'BTC', mid: '50000' },
      warnings: ['Test warning'],
    };
    const out = formatResult(result);
    assert.ok(out.includes('Test warning'));
  });
});
