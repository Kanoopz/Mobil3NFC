// Blockchain Network Constants
// Monad Testnet Configuration

export const MONAD_TESTNET = {
  // Basic Chain Information
  name: 'Monad Testnet',
  chainId: 10143,
  chainIdHex: '0x279f',
  currency: 'MON',
  logo: 'Monad Testnet logo',
  
  // RPC Endpoints (sorted by latency)
  rpcUrls: [
    {
      name: 'Monad Official',
      url: 'https://testnet-rpc.monad.xyz',
      latency: '0.075s',
      height: 32742158,
      isOfficial: true
    },
    {
      name: 'DRPC WebSocket',
      url: 'wss://monad-testnet.drpc.org',
      latency: '0.080s',
      height: 32742158,
      isWebSocket: true
    },
    {
      name: 'DRPC HTTP',
      url: 'https://monad-testnet.drpc.org',
      latency: '0.109s',
      height: 32742158
    },
    {
      name: 'Ankr',
      url: 'https://rpc.ankr.com/monad_testnet',
      latency: '0.142s',
      height: 32742158
    },
    {
      name: 'Tatum Gateway',
      url: 'https://monad-testnet.gateway.tatum.io',
      latency: '0.318s',
      height: 32742159
    }
  ],
  
  // Get the fastest RPC URL
  getFastestRpcUrl(): string {
    return this.rpcUrls[0].url; // Monad Official is fastest
  },
  
  // Get WebSocket URL
  getWebSocketUrl(): string {
    const wsEndpoint = this.rpcUrls.find(rpc => rpc.isWebSocket);
    return wsEndpoint ? wsEndpoint.url : '';
  },
  
  // Get all HTTP RPC URLs
  getHttpRpcUrls(): string[] {
    return this.rpcUrls
      .filter(rpc => !rpc.isWebSocket)
      .map(rpc => rpc.url);
  },
  
  // Get official RPC URL
  getOfficialRpcUrl(): string {
    const official = this.rpcUrls.find(rpc => rpc.isOfficial);
    return official ? official.url : this.rpcUrls[0].url;
  }
};

// Network type for easier identification
export const NETWORK_TYPE = {
  MONAD_TESTNET: 'monad_testnet'
} as const;

// Chain ID constants
export const CHAIN_IDS = {
  MONAD_TESTNET: 10143
} as const;

// Currency symbols
export const CURRENCIES = {
  MON: 'MON'
} as const;

// Token interface
export interface Token {
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  logoURI: string;
}

// Native MON token address for balance checking
export const NATIVE_MON_ADDRESS = "0x0000000000000000000000000000000000000000";

// Monad Testnet Tokens
export const MONAD_TESTNET_TOKENS: Token[] = [
  {
    chainId: 10143,
    name: "Monad",
    symbol: "MON",
    decimals: 18,
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Native token address for 0x API
    logoURI: "https://assets.coingecko.com/coins/images/34503/small/monad.jpg",
  },
  {
    chainId: 10143,
    name: "Wrapped Monad",
    symbol: "WMON",
    decimals: 18,
    address: "0x760afe86e5de5fa0ee542fc7b7b713e1c5425701",
    logoURI: "https://assets.coingecko.com/coins/images/34503/small/monad.jpg",
  },
  {
    chainId: 10143,
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    address: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
  },
  {
    chainId: 10143,
    name: "Wrapped Ethereum",
    symbol: "WETH",
    decimals: 18,
    address: "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png",
  },
  {
    chainId: 10143,
    name: "Tether USD",
    symbol: "USDT",
    decimals: 6,
    address: "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
  },
  {
    chainId: 10143,
    name: "Wrapped Bitcoin",
    symbol: "WBTC",
    decimals: 8,
    address: "0xcf5a6076cfa32686c0Df13aBaDa2b40dec133F1d",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png",
  },
  {
    chainId: 10143,
    name: "Pingu",
    symbol: "PINGU",
    decimals: 18,
    address: "0xA2426cD97583939E79Cfc12aC6E9121e37D0904d",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
  },
];

// Token utility functions
export const getTokenBySymbol = (symbol: string): Token | undefined => {
  return MONAD_TESTNET_TOKENS.find(token => token.symbol === symbol);
};

export const getTokenByAddress = (address: string): Token | undefined => {
  return MONAD_TESTNET_TOKENS.find(token => 
    token.address.toLowerCase() === address.toLowerCase()
  );
};

export const getTokenSymbols = (): string[] => {
  return MONAD_TESTNET_TOKENS.map(token => token.symbol);
};

export const getTokenAddresses = (): string[] => {
  return MONAD_TESTNET_TOKENS.map(token => token.address);
};

// Default network configuration
export const DEFAULT_NETWORK = MONAD_TESTNET;

// Network validation
export const isValidMonadTestnetChainId = (chainId: number): boolean => {
  return chainId === MONAD_TESTNET.chainId;
};

// RPC URL validation
export const isValidMonadTestnetRpcUrl = (url: string): boolean => {
  return MONAD_TESTNET.rpcUrls.some(rpc => rpc.url === url);
};

// Export all constants
export default {
  MONAD_TESTNET,
  NETWORK_TYPE,
  CHAIN_IDS,
  CURRENCIES,
  MONAD_TESTNET_TOKENS,
  getTokenBySymbol,
  getTokenByAddress,
  getTokenSymbols,
  getTokenAddresses,
  DEFAULT_NETWORK,
  isValidMonadTestnetChainId,
  isValidMonadTestnetRpcUrl
};
