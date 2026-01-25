// Token definitions for Solana and other supported chains

export enum SupportedChain {
  Solana = 'Solana',
  Hyperliquid = 'Hyperliquid',
}

export enum SupportedToken {
  USDC = 'USDC',
  USDT = 'USDT',
  SOL = 'SOL',
  WBTC = 'WBTC',
  WETH = 'WETH',
  JLP = 'JLP',
}

export interface Token {
  name: string
  symbol: string
  onChain: {
    [chain in SupportedChain]: {
      address: string
      decimals: number
    } | null;
  }
}

export const tokens: { [name in SupportedToken]: Token } = {
  [SupportedToken.USDC]: {
    name: 'USD Coin',
    symbol: 'USDC',
    onChain: {
      [SupportedChain.Solana]: {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
      },
      [SupportedChain.Hyperliquid]: null,
    },
  },
  [SupportedToken.USDT]: {
    name: 'Tether',
    symbol: 'USDT',
    onChain: {
      [SupportedChain.Solana]: {
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        decimals: 6,
      },
      [SupportedChain.Hyperliquid]: null,
    },
  },
  [SupportedToken.SOL]: {
    name: 'Wrapped SOL',
    symbol: 'WSOL',
    onChain: {
      [SupportedChain.Solana]: {
        address: 'So11111111111111111111111111111111111111112',
        decimals: 9,
      },
      [SupportedChain.Hyperliquid]: null,
    },
  },
  [SupportedToken.WBTC]: {
    name: 'Wrapped BTC (Wormhole) (WBTC)',
    symbol: 'WBTC',
    onChain: {
      [SupportedChain.Solana]: {
        address: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
        decimals: 8,
      },
      [SupportedChain.Hyperliquid]: null,
    },
  },
  [SupportedToken.WETH]: {
    name: 'Wrapped ETH (Wormhole) (WETH)',
    symbol: 'WETH',
    onChain: {
      [SupportedChain.Solana]: {
        address: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
        decimals: 8,
      },
      [SupportedChain.Hyperliquid]: null,
    },
  },
  [SupportedToken.JLP]: {
    name: 'Jupiter Perps LP',
    symbol: 'JLP',
    onChain: {
      [SupportedChain.Solana]: {
        address: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',
        decimals: 6,
      },
      [SupportedChain.Hyperliquid]: null,
    },
  },
}
