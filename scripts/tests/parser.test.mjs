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

  describe('news commands', () => {
    it('parses news with positional asset', () => {
      const r = parseInput('dpro-hl news BTC --category hot-24h --limit 5');
      assert.equal(r.domain, 'news');
      assert.equal(r.action, 'list');
      assert.equal(r.target, 'BTC');
      assert.equal(r.flags.category, 'hot-24h');
      assert.equal(r.flags.limit, '5');
    });

    it('parses news with asset flag', () => {
      const r = parseInput('dpro-hl news --asset xyz:AAPL --locale en');
      assert.equal(r.domain, 'news');
      assert.equal(r.action, 'list');
      assert.equal(r.target, null);
      assert.equal(r.flags.asset, 'xyz:AAPL');
      assert.equal(r.flags.locale, 'en');
    });

    it('parses news list alias', () => {
      const r = parseInput('dpro-hl news list PEPE/USDC --category hot-7d');
      assert.equal(r.domain, 'news');
      assert.equal(r.action, 'list');
      assert.equal(r.target, 'PEPE/USDC');
      assert.equal(r.flags.category, 'hot-7d');
    });

    it('parses news detail', () => {
      const r = parseInput('dpro-hl news detail 12345 --asset BTC --locale zh-CN');
      assert.equal(r.domain, 'news');
      assert.equal(r.action, 'detail');
      assert.equal(r.target, '12345');
      assert.equal(r.flags.asset, 'BTC');
      assert.equal(r.flags.locale, 'zh-CN');
    });
  });

  describe('account commands', () => {
    it('rejects deprecated --password flag', () => {
      assert.throws(
        () => parseInput('dpro-hl account ls --password 123'),
        /no longer supported/i,
      );
    });

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

    it('parses account clear-password-cache', () => {
      const r = parseInput('dpro-hl account clear-password-cache');
      assert.equal(r.domain, 'account');
      assert.equal(r.action, 'clear-password-cache');
    });

    it('parses account add-master', () => {
      const r = parseInput('dpro-hl account add-master 0x1234567890abcdef1234567890abcdef12345678 0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd');
      assert.equal(r.domain, 'account');
      assert.equal(r.action, 'add-master');
      assert.equal(r.target, '0x1234567890abcdef1234567890abcdef12345678');
      assert.equal(r.args.rest[0], '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd');
    });

    it('parses account update-master', () => {
      const r = parseInput('dpro-hl account update-master 0x1234567890abcdef1234567890abcdef12345678 0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd');
      assert.equal(r.domain, 'account');
      assert.equal(r.action, 'update-master');
      assert.equal(r.target, '0x1234567890abcdef1234567890abcdef12345678');
    });

    it('parses account remove-master', () => {
      const r = parseInput('dpro-hl account remove-master 0x1234567890abcdef1234567890abcdef12345678');
      assert.equal(r.domain, 'account');
      assert.equal(r.action, 'remove-master');
      assert.equal(r.target, '0x1234567890abcdef1234567890abcdef12345678');
    });

    it('rejects old add-master syntax', () => {
      assert.throws(
        () => parseInput('dpro-hl account add-master 0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd main'),
        /Usage: dpro-hl account add-master/i,
      );
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

    it('parses order-history shortcut', () => {
      const r = parseInput('dpro-hl order-history main --limit 20');
      assert.equal(r.domain, 'account');
      assert.equal(r.action, 'order-history');
      assert.equal(r.target, 'main');
      assert.equal(r.flags.limit, '20');
    });

    it('parses funding-history shortcut', () => {
      const r = parseInput('dpro-hl funding-history main --start-time 1 --end-time 2 --limit 10');
      assert.equal(r.domain, 'account');
      assert.equal(r.action, 'funding-history');
      assert.equal(r.target, 'main');
      assert.equal(r.flags['start-time'], '1');
      assert.equal(r.flags['end-time'], '2');
      assert.equal(r.flags.limit, '10');
    });

    it('parses twap-history shortcut', () => {
      const r = parseInput('dpro-hl twap-history main --limit 15');
      assert.equal(r.domain, 'account');
      assert.equal(r.action, 'twap-history');
      assert.equal(r.target, 'main');
      assert.equal(r.flags.limit, '15');
    });

    it('parses twap-fill-history shortcut', () => {
      const r = parseInput('dpro-hl twap-fill-history main --limit 10');
      assert.equal(r.domain, 'account');
      assert.equal(r.action, 'twap-fill-history');
      assert.equal(r.target, 'main');
      assert.equal(r.flags.limit, '10');
    });
  });

  describe('trade commands', () => {
    it('parses limit buy', () => {
      const r = parseInput('dpro-hl perp order limit buy 0.01 BTC 50000');
      assert.equal(r.domain, 'trade');
      assert.equal(r.action, 'limit');
      assert.equal(r.marketType, 'perp');
      assert.equal(r.target, 'BTC');
      assert.equal(r.args.side, 'buy');
      assert.equal(r.args.size, '0.01');
      assert.equal(r.args.price, '50000');
    });

    it('parses spot market sell', () => {
      const r = parseInput('dpro-hl spot order market sell 1.5 ETH');
      assert.equal(r.action, 'market');
      assert.equal(r.marketType, 'spot');
      assert.equal(r.args.side, 'sell');
      assert.equal(r.args.size, '1.5');
      assert.equal(r.target, 'ETH');
    });

    it('parses hip3 market order with namespaced coin', () => {
      const r = parseInput('dpro-hl hip3 order market buy 1 xyz:AAPL');
      assert.equal(r.action, 'market');
      assert.equal(r.marketType, 'hip3');
      assert.equal(r.args.side, 'buy');
      assert.equal(r.target, 'XYZ:AAPL');
    });

    it('parses cancel', () => {
      const r = parseInput('dpro-hl perp order cancel 12345');
      assert.equal(r.action, 'cancel');
      assert.equal(r.marketType, 'perp');
      assert.equal(r.target, '12345');
    });

    it('parses cancel-all', () => {
      const r = parseInput('dpro-hl spot order cancel-all');
      assert.equal(r.action, 'cancel-all');
      assert.equal(r.marketType, 'spot');
    });

    it('parses set-leverage', () => {
      const r = parseInput('dpro-hl perp order set-leverage BTC 10 --cross');
      assert.equal(r.action, 'set-leverage');
      assert.equal(r.marketType, 'perp');
      assert.equal(r.target, 'BTC');
      assert.equal(r.args.leverage, '10');
      assert.equal(r.flags.cross, true);
    });

    it('parses limit with tif and reduce-only', () => {
      const r = parseInput('dpro-hl perp order limit sell 0.5 ETH 3500 --tif Alo --reduce-only');
      assert.equal(r.args.side, 'sell');
      assert.equal(r.flags.tif, 'Alo');
      assert.equal(r.flags['reduce-only'], true);
    });

    it('parses approve-builder', () => {
      const r = parseInput('dpro-hl approve-builder');
      assert.equal(r.domain, 'trade');
      assert.equal(r.action, 'approve-builder');
    });

    it('parses modify order command', () => {
      const r = parseInput('dpro-hl perp order modify 123 buy 0.01 BTC 50000 --tif Gtc');
      assert.equal(r.action, 'modify');
      assert.equal(r.marketType, 'perp');
      assert.equal(r.target, '123');
      assert.equal(r.args.coin, 'BTC');
      assert.equal(r.args.side, 'buy');
      assert.equal(r.args.size, '0.01');
      assert.equal(r.args.price, '50000');
      assert.equal(r.flags.tif, 'Gtc');
    });

    it('parses twap-create command', () => {
      const r = parseInput('dpro-hl hip3 order twap-create buy 1 xyz:NVDA --minutes 10 --randomize');
      assert.equal(r.action, 'twap-create');
      assert.equal(r.marketType, 'hip3');
      assert.equal(r.target, 'XYZ:NVDA');
      assert.equal(r.args.side, 'buy');
      assert.equal(r.args.size, '1');
      assert.equal(r.flags.minutes, '10');
      assert.equal(r.flags.randomize, true);
    });

    it('parses twap-cancel command', () => {
      const r = parseInput('dpro-hl perp order twap-cancel BTC 12');
      assert.equal(r.action, 'twap-cancel');
      assert.equal(r.marketType, 'perp');
      assert.equal(r.target, 'BTC');
      assert.equal(r.args.twapId, '12');
    });

    it('parses batch-limit command', () => {
      const r = parseInput('dpro-hl spot order batch-limit buy PURR 10@0.08,20@0.07 --tif Alo');
      assert.equal(r.action, 'batch-limit');
      assert.equal(r.marketType, 'spot');
      assert.equal(r.target, 'PURR');
      assert.equal(r.args.side, 'buy');
      assert.equal(r.args.entries, '10@0.08,20@0.07');
      assert.equal(r.flags.tif, 'Alo');
    });

    it('parses cancel-multiple command', () => {
      const r = parseInput('dpro-hl perp order cancel-multiple 1,2,3');
      assert.equal(r.action, 'cancel-multiple');
      assert.equal(r.marketType, 'perp');
      assert.equal(r.args.oids, '1,2,3');
    });

    it('parses close-position command', () => {
      const r = parseInput('dpro-hl perp order close-position BTC --size 0.1 --slippage 0.5');
      assert.equal(r.action, 'close-position');
      assert.equal(r.marketType, 'perp');
      assert.equal(r.target, 'BTC');
      assert.equal(r.flags.size, '0.1');
      assert.equal(r.flags.slippage, '0.5');
    });

    it('parses reverse-position command', () => {
      const r = parseInput('dpro-hl hip3 order reverse-position xyz:NVDA --size 1');
      assert.equal(r.action, 'reverse-position');
      assert.equal(r.marketType, 'hip3');
      assert.equal(r.target, 'XYZ:NVDA');
      assert.equal(r.flags.size, '1');
    });

    it('parses scale-order command', () => {
      const r = parseInput('dpro-hl perp order scale-order buy BTC --from 100 --to 110 --count 5 --total-size 1');
      assert.equal(r.action, 'scale-order');
      assert.equal(r.args.side, 'buy');
      assert.equal(r.target, 'BTC');
      assert.equal(r.flags.from, '100');
      assert.equal(r.flags.to, '110');
      assert.equal(r.flags.count, '5');
      assert.equal(r.flags['total-size'], '1');
    });

    it('parses tpsl command', () => {
      const r = parseInput('dpro-hl perp order tpsl BTC --tp 120 --sl 90 --size 0.2');
      assert.equal(r.action, 'tpsl');
      assert.equal(r.target, 'BTC');
      assert.equal(r.flags.tp, '120');
      assert.equal(r.flags.sl, '90');
      assert.equal(r.flags.size, '0.2');
    });

    it('parses oto command', () => {
      const r = parseInput('dpro-hl perp order oto buy 0.2 BTC 100 --tp 110 --sl 95');
      assert.equal(r.action, 'oto');
      assert.equal(r.target, 'BTC');
      assert.equal(r.args.side, 'buy');
      assert.equal(r.args.size, '0.2');
      assert.equal(r.args.entryPrice, '100');
      assert.equal(r.flags.tp, '110');
      assert.equal(r.flags.sl, '95');
    });

    it('parses builder-approval with explicit target', () => {
      const r = parseInput('dpro-hl builder-approval main --builder 0xf36534b07ea0cbbe52194374e7387956fb97ad53');
      assert.equal(r.domain, 'trade');
      assert.equal(r.action, 'builder-approval');
      assert.equal(r.target, 'main');
      assert.equal(r.flags.builder, '0xf36534b07ea0cbbe52194374e7387956fb97ad53');
    });

    it('throws on missing side', () => {
      assert.throws(() => parseInput('dpro-hl perp order limit 0.01 BTC 50000'), /side/i);
    });

    it('rejects legacy order command', () => {
      assert.throws(() => parseInput('dpro-hl order limit buy 0.01 BTC 50000'), /no longer supported/i);
    });
  });

  describe('transfer commands', () => {
    it('parses transfer with default direction', () => {
      const r = parseInput('dpro-hl transfer 10');
      assert.equal(r.domain, 'transfer');
      assert.equal(r.action, 'transfer');
      assert.equal(r.args.usd, '10');
    });

    it('parses transfer with --to spot', () => {
      const r = parseInput('dpro-hl transfer 10 --to spot');
      assert.equal(r.domain, 'transfer');
      assert.equal(r.action, 'transfer');
      assert.equal(r.args.usd, '10');
      assert.equal(r.flags.to, 'spot');
    });

    it('rejects transfer without amount', () => {
      assert.throws(() => parseInput('dpro-hl transfer'), /Usage: dpro-hl transfer/i);
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

    it('parses onchain orders-book command', () => {
      const r = parseInput('dpro-hl onchain orders-book BTC --page 1 --limit 20');
      assert.equal(r.domain, 'onchain');
      assert.equal(r.action, 'orders-book');
      assert.equal(r.target, 'BTC');
      assert.equal(r.flags.limit, '20');
    });

    it('parses onchain liqmap-timeline command', () => {
      const r = parseInput('dpro-hl onchain liqmap-timeline BTC --from 2025-01-01 --to 2025-01-07');
      assert.equal(r.domain, 'onchain');
      assert.equal(r.action, 'liqmap-timeline');
      assert.equal(r.target, 'BTC');
      assert.equal(r.flags.from, '2025-01-01');
      assert.equal(r.flags.to, '2025-01-07');
    });

    it('parses onchain hip3-fills command', () => {
      const r = parseInput('dpro-hl onchain hip3-fills xyz:TSLA --startTime 1 --endTime 2 --limit 5');
      assert.equal(r.domain, 'onchain');
      assert.equal(r.action, 'hip3-fills');
      assert.equal(r.target, 'XYZ:TSLA');
      assert.equal(r.flags.startTime, '1');
      assert.equal(r.flags.endTime, '2');
      assert.equal(r.flags.limit, '5');
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

    it('parses natural language news', () => {
      const r = parseInput('show me BTC news');
      assert.equal(r.domain, 'news');
      assert.equal(r.action, 'list');
      assert.equal(r.target, 'BTC');
    });

    it('parses Chinese natural language news', () => {
      const r = parseInput('BTC \u65b0\u95fb');
      assert.equal(r.domain, 'news');
      assert.equal(r.action, 'list');
      assert.equal(r.target, 'BTC');
    });

    it('rejects buy NL without namespace', () => {
      assert.throws(
        () => parseInput('\u4e70\u5165 0.5 ETH'),
        /must specify a market namespace/i,
      );
    });

    it('rejects buy NL with namespaced coin when namespace missing', () => {
      assert.throws(
        () => parseInput('buy 1 xyz:AAPL'),
        /must specify a market namespace/i,
      );
    });

    it('throws on unparseable input', () => {
      assert.throws(() => parseInput('hello world random text'));
    });
  });
});
