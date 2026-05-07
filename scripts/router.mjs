import { unknownCommand } from './errors.mjs';

// Command handlers registered by domain
const handlers = {
  market: null,
  account: null,
  trade: null,
  transfer: null,
  onchain: null,
  news: null,
};

export function registerHandlers({ market, account, trade, transfer, onchain, news }) {
  if (market) handlers.market = market;
  if (account) handlers.account = account;
  if (trade) handlers.trade = trade;
  if (transfer) handlers.transfer = transfer;
  if (onchain) handlers.onchain = onchain;
  if (news) handlers.news = news;
}

export async function routeCommand(parsed, ctx) {
  const { domain, action } = parsed;

  if (domain === 'help') {
    return {
      ok: true,
      type: 'help',
      data: {
        message: 'Hyperliquid-dPro — use "dpro-hl quote BTC", "dpro-hl news BTC --limit 5", "dpro-hl transfer 10 --to perp", "dpro-hl onchain health", "dpro-hl book ETH", "dpro-hl markets ls", "dpro-hl account ls", "dpro-hl builder-approval", "dpro-hl spot order limit buy 0.01 BTC 50000", etc.',
      },
    };
  }

  const handler = handlers[domain];
  if (!handler) {
    throw unknownCommand(`No handler registered for domain: ${domain}`);
  }

  if (typeof handler[action] !== 'function') {
    // Try kebab-to-camel: "markets-ls" -> "marketsLs", "add-readonly" -> "addReadonly"
    const camel = action.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (typeof handler[camel] === 'function') {
      return handler[camel](parsed, ctx);
    }
    throw unknownCommand(`Unknown action "${action}" in domain "${domain}"`);
  }

  return handler[action](parsed, ctx);
}
