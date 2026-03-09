import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseInput } from '../parser.mjs';

describe('parser', () => {
  describe('prefix stripping', () => {
    it('strips "dpro-hl " prefix', () => {
      const r = parseInput('dpro-hl quote BTC');
      assert.equal(r.domain, 'market');
      assert.equal(r.action, 'quote');
      assert.equal(r.target, 'BTC');
    });

    it('strips "/dpro-hl " prefix', () => {
      const r = parseInput('/dpro-hl book ETH');
      assert.equal(r.domain, 'market');
      assert.equal(r.action, 'book');
      assert.equal(r.target, 'ETH');
    });

    it('handles bare "dpro-hl" as help', () => {
      const r = parseInput('dpro-hl');
      assert.equal(r.domain, 'help');
    });

    it('rejects legacy "hl" prefix', () => {
      assert.throws(() => parseInput('hl quote BTC'), /Could not parse input/i);
    });

    it('rejects legacy "/hl" prefix', () => {
      assert.throws(() => parseInput('/hl quote BTC'), /Could not parse input/i);
    });
  });

  describe('market commands', () => {
    it('parses quote', () => {
      const r = parseInput('dpro-hl quote SOL');
      assert.equal(r.domain, 'market');
      assert.equal(r.action, 'quote');
      assert.equal(r.target, 'SOL');
    });

    it('parses book with levels flag', () => {
      const r = parseInput('dpro-hl book ETH --levels 5');
      assert.equal(r.action, 'book');
      assert.equal(r.target, 'ETH');
      assert.equal(r.flags.levels, '5');
    });

    it('parses candles with interval and last', () => {
      const r = parseInput('dpro-hl candles BTC --interval 1h --last 48');
      assert.equal(r.action, 'candles');
      assert.equal(r.target, 'BTC');
      assert.equal(r.flags.interval, '1h');
      assert.equal(r.flags.last, '48');
    });

    it('parses movers with side and top', () => {
      const r = parseInput('dpro-hl movers --side gainers --top 5');
      assert.equal(r.action, 'movers');
      assert.equal(r.flags.side, 'gainers');
      assert.equal(r.flags.top, '5');
    });

    it('parses markets ls', () => {
      const r = parseInput('dpro-hl markets ls');
      assert.equal(r.domain, 'market');
      assert.equal(r.action, 'markets-ls');
    });
  });

  describe('account commands', () => {
    it('parses account ls', () => {
      const r = parseInput('dpro-hl account ls');
      assert.equal(r.domain, 'account');
      assert.equal(r.action, 'ls');
    });

    it('parses account add-readonly', () => {
      const r = parseInput('dpro-hl account add-readonly 0x1234567890abcdef1234567890abcdef12345678 myalias');
      assert.equal(r.action, 'add-readonly');
      assert.equal(r.target, '0x1234567890abcdef1234567890abcdef12345678');
      assert.deepEqual(r.args.rest, ['myalias']);
    });

    it('parses positions shortcut', () => {
      const r = parseInput('dpro-hl positions main');
      assert.equal(r.domain, 'account');
      assert.equal(r.action, 'positions');
      assert.equal(r.target, 'main');
    });

    it('parses fills with limit flag', () => {
      const r = parseInput('dpro-hl fills --limit 50');
      assert.equal(r.domain, 'account');
      assert.equal(r.action, 'fills');
      assert.equal(r.flags.limit, '50');
    });
  });

  describe('trade commands', () => {
    it('parses limit buy', () => {
      const r = parseInput('dpro-hl order limit buy 0.01 BTC 50000');
      assert.equal(r.domain, 'trade');
      assert.equal(r.action, 'limit');
      assert.equal(r.target, 'BTC');
      assert.equal(r.args.side, 'buy');
      assert.equal(r.args.size, '0.01');
      assert.equal(r.args.price, '50000');
    });

    it('parses market sell', () => {
      const r = parseInput('dpro-hl order market sell 1.5 ETH');
      assert.equal(r.action, 'market');
      assert.equal(r.args.side, 'sell');
      assert.equal(r.args.size, '1.5');
      assert.equal(r.target, 'ETH');
    });

    it('parses market order with namespaced coin', () => {
      const r = parseInput('dpro-hl order market buy 1 xyz:AAPL');
      assert.equal(r.action, 'market');
      assert.equal(r.args.side, 'buy');
      assert.equal(r.target, 'XYZ:AAPL');
    });

    it('parses cancel', () => {
      const r = parseInput('dpro-hl order cancel 12345');
      assert.equal(r.action, 'cancel');
      assert.equal(r.target, '12345');
    });

    it('parses cancel-all', () => {
      const r = parseInput('dpro-hl order cancel-all');
      assert.equal(r.action, 'cancel-all');
    });

    it('parses set-leverage', () => {
      const r = parseInput('dpro-hl order set-leverage BTC 10 --cross');
      assert.equal(r.action, 'set-leverage');
      assert.equal(r.target, 'BTC');
      assert.equal(r.args.leverage, '10');
      assert.equal(r.flags.cross, true);
    });

    it('parses limit with tif and reduce-only', () => {
      const r = parseInput('dpro-hl order limit sell 0.5 ETH 3500 --tif Alo --reduce-only');
      assert.equal(r.args.side, 'sell');
      assert.equal(r.flags.tif, 'Alo');
      assert.equal(r.flags['reduce-only'], true);
    });

    it('parses approve-builder', () => {
      const r = parseInput('dpro-hl approve-builder');
      assert.equal(r.domain, 'trade');
      assert.equal(r.action, 'approve-builder');
    });

    it('throws on missing side', () => {
      assert.throws(() => parseInput('dpro-hl order limit 0.01 BTC 50000'), /side/i);
    });
  });

  describe('onchain commands', () => {
    it('parses onchain health', () => {
      const r = parseInput('dpro-hl onchain health');
      assert.equal(r.domain, 'onchain');
      assert.equal(r.action, 'health');
      assert.equal(r.target, null);
    });

    it('parses onchain spot-holders with coin', () => {
      const r = parseInput('dpro-hl onchain spot-holders purr --limit 5');
      assert.equal(r.domain, 'onchain');
      assert.equal(r.action, 'spot-holders');
      assert.equal(r.target, 'PURR');
      assert.equal(r.flags.limit, '5');
    });

    it('parses onchain perp-holders with flags', () => {
      const r = parseInput('dpro-hl onchain perp-holders xyz:NVDA --order desc --page 2');
      assert.equal(r.domain, 'onchain');
      assert.equal(r.action, 'perp-holders');
      assert.equal(r.target, 'XYZ:NVDA');
      assert.equal(r.flags.order, 'desc');
      assert.equal(r.flags.page, '2');
    });
  });

  describe('natural language', () => {
    it('parses Chinese quote', () => {
      const r = parseInput('\u67e5 BTC \u62a5\u4ef7');
      assert.equal(r.domain, 'market');
      assert.equal(r.action, 'quote');
      assert.equal(r.target, 'BTC');
    });

    it('parses Chinese book', () => {
      const r = parseInput('\u770b ETH \u76d8\u53e3');
      assert.equal(r.domain, 'market');
      assert.equal(r.action, 'book');
      assert.equal(r.target, 'ETH');
    });

    it('parses Chinese candles with interval', () => {
      const r = parseInput('SOL 1h K\u7ebf\u6700\u8fd148\u6839');
      assert.equal(r.domain, 'market');
      assert.equal(r.action, 'candles');
      assert.equal(r.target, 'SOL');
      assert.equal(r.flags.interval, '1h');
      assert.equal(r.flags.last, '48');
    });

    it('parses Chinese positions', () => {
      const r = parseInput('\u770b\u6301\u4ed3');
      assert.equal(r.domain, 'account');
      assert.equal(r.action, 'positions');
    });

    it('parses buy NL', () => {
      const r = parseInput('\u4e70\u5165 0.5 ETH');
      assert.equal(r.domain, 'trade');
      assert.equal(r.action, 'market');
      assert.equal(r.args.side, 'buy');
      assert.equal(r.args.size, '0.5');
      assert.equal(r.target, 'ETH');
    });

    it('parses buy NL with namespaced coin', () => {
      const r = parseInput('buy 1 xyz:AAPL');
      assert.equal(r.domain, 'trade');
      assert.equal(r.action, 'market');
      assert.equal(r.args.side, 'buy');
      assert.equal(r.target, 'XYZ:AAPL');
    });

    it('throws on unparseable input', () => {
      assert.throws(() => parseInput('hello world random text'));
    });
  });
});
