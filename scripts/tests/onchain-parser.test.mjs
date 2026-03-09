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
});
