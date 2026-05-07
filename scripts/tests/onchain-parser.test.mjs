import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseInput } from '../parser.mjs';

describe('onchain parser', () => {
  it('parses simple command', () => {
    const parsed = parseInput('dpro-hl onchain mids');
    assert.equal(parsed.domain, 'onchain');
    assert.equal(parsed.action, 'mids');
  });

  it('parses spot-holders command', () => {
    const parsed = parseInput('dpro-hl onchain spot-holders PURR --page 2 --limit 20');
    assert.equal(parsed.domain, 'onchain');
    assert.equal(parsed.action, 'spot-holders');
    assert.equal(parsed.target, 'PURR');
    assert.equal(parsed.flags.page, '2');
    assert.equal(parsed.flags.limit, '20');
  });

  it('parses leaderboard command', () => {
    const parsed = parseInput('dpro-hl onchain leaderboard --sort pnl --order desc');
    assert.equal(parsed.domain, 'onchain');
    assert.equal(parsed.action, 'leaderboard');
    assert.equal(parsed.flags.sort, 'pnl');
    assert.equal(parsed.flags.order, 'desc');
  });

  it('parses liqmap timeline command', () => {
    const parsed = parseInput('dpro-hl onchain liqmap-timeline BTC --from 2025-01-01T00:00:00Z --to 2025-01-07T00:00:00Z');
    assert.equal(parsed.domain, 'onchain');
    assert.equal(parsed.action, 'liqmap-timeline');
    assert.equal(parsed.target, 'BTC');
    assert.equal(parsed.flags.from, '2025-01-01T00:00:00Z');
    assert.equal(parsed.flags.to, '2025-01-07T00:00:00Z');
  });

  it('parses orders book command', () => {
    const parsed = parseInput('dpro-hl onchain orders-book BTC --page 1 --limit 20');
    assert.equal(parsed.domain, 'onchain');
    assert.equal(parsed.action, 'orders-book');
    assert.equal(parsed.target, 'BTC');
    assert.equal(parsed.flags.page, '1');
    assert.equal(parsed.flags.limit, '20');
  });

  it('parses hip3-fills command', () => {
    const parsed = parseInput('dpro-hl onchain hip3-fills xyz:TSLA --startTime 1 --endTime 2 --page 1 --limit 20');
    assert.equal(parsed.domain, 'onchain');
    assert.equal(parsed.action, 'hip3-fills');
    assert.equal(parsed.target, 'XYZ:TSLA');
    assert.equal(parsed.flags.startTime, '1');
    assert.equal(parsed.flags.endTime, '2');
    assert.equal(parsed.flags.page, '1');
    assert.equal(parsed.flags.limit, '20');
  });

  it('parses prediction positions command', () => {
    const parsed = parseInput('dpro-hl onchain prediction-positions 9 --limit 10');
    assert.equal(parsed.domain, 'onchain');
    assert.equal(parsed.action, 'prediction-positions');
    assert.equal(parsed.target, '9');
    assert.equal(parsed.flags.limit, '10');
  });

  it('parses prediction order book flags', () => {
    const parsed = parseInput('dpro-hl onchain prediction-orders-book --outcome-id 9 --side 0');
    assert.equal(parsed.domain, 'onchain');
    assert.equal(parsed.action, 'prediction-orders-book');
    assert.equal(parsed.flags['outcome-id'], '9');
    assert.equal(parsed.flags.side, '0');
  });

  it('parses tradfi and smart trader commands', () => {
    const tradfi = parseInput('dpro-hl onchain tradfi-gainers-holder-pnl-top --asset-limit 5 --holder-limit 3');
    assert.equal(tradfi.action, 'tradfi-gainers-holder-pnl-top');
    assert.equal(tradfi.flags['asset-limit'], '5');

    const hip3 = parseInput('dpro-hl onchain hip3-smart-trader xyz:tsla --sort pnlPct --limit 10');
    assert.equal(hip3.action, 'hip3-smart-trader');
    assert.equal(hip3.target, 'XYZ:TSLA');

    const hip4 = parseInput('dpro-hl onchain hip4-smart-trader 123 --sort pnl');
    assert.equal(hip4.action, 'hip4-smart-trader');
    assert.equal(hip4.target, '123');
  });
});
