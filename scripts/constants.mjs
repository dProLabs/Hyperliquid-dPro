// API endpoints
export const MAINNET_URL = 'https://api.hyperliquid.xyz';
export const TESTNET_URL = 'https://api.hyperliquid-testnet.xyz';

// Builder code
export const BUILDER_ADDRESS = '0x8c967E73E7B15087c42A10D344cFf4c96D877f1D';
export const BUILDER_FEE = 1; // fee in tenths of a basis point (1 = 0.1bp = 0.001%)
export const BUILDER_MAX_FEE_RATE = '0.01%'; // max fee rate for approveBuilderFee

// signatureChainId for user-signed actions (Arbitrum One)
export const SIGNATURE_CHAIN_ID_MAINNET = '0xa4b1';
export const SIGNATURE_CHAIN_ID_TESTNET = '0x66eee';

// EIP-712 domains
export const EXCHANGE_DOMAIN = {
  name: 'Exchange',
  version: '1',
  chainId: 1337,
  verifyingContract: '0x0000000000000000000000000000000000000000',
};

export const USER_SIGNED_DOMAIN = {
  name: 'HyperliquidSignTransaction',
  version: '1',
  chainId: 42161,
  verifyingContract: '0x0000000000000000000000000000000000000000',
};

// Network source bytes for phantom agent
export const NETWORK_SOURCE = {
  mainnet: 'a',
  testnet: 'b',
};

// Candle intervals whitelist
export const CANDLE_INTERVALS = [
  '1m', '3m', '5m', '15m', '30m',
  '1h', '2h', '4h', '8h', '12h',
  '1d', '3d', '1w', '1M',
];

// Defaults
export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_BOOK_LEVELS = 10;
export const DEFAULT_CANDLE_COUNT = 20;
export const DEFAULT_FILL_LIMIT = 20;
export const DEFAULT_MOVERS_TOP = 10;
export const DEFAULT_SLIPPAGE_PCT = 0.5; // 0.5%
export const DEFAULT_AUTO_UPGRADE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Config paths
export const CONFIG_DIR = '.config/dpro-hl';
export const CONFIG_FILE = 'config.json';
export const UPGRADE_STATE_FILE = 'upgrade-state.json';
export const KEYS_FILE = 'keys.enc';
export const PASSWORD_CACHE_FILE = 'password-session.json';
export const DEFAULT_PASSWORD_CACHE_TTL_SEC = 6 * 60 * 60; // 6 hours

// Asset resolver cache TTL
export const ASSET_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
