const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface MarketCapDataPoint {
  timestamp: number;
  executionPriceSol: number;
  marketCapSol: number;
  marketCapUsd: number;
  solPriceUsd: number;
  tradeType: 'buy' | 'sell';
  signature: string;
}

export interface Token {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  bondingCurve: string;
  createdAt: string;
  createTxSignature: string;
  marketCapTimeSeries: MarketCapDataPoint[];
  initialMarketCapUsd: number | null;
  peakMarketCapUsd: number | null;
  finalMarketCapUsd: number | null;
  tradeCount15s: number;
  bonded: boolean;
  athMarketCapUsd: number | null;
  trackedAt: string;
  updatedAt: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TokensResponse {
  tokens: Token[];
  pagination: PaginationInfo;
}

export async function getCreatedTokens(page: number = 1, limit: number = 20, creatorWallet?: string, viewAll: boolean = false): Promise<TokensResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  
  if (creatorWallet) {
    params.append('creator', creatorWallet);
  }
  
  if (viewAll) {
    params.append('viewAll', 'true');
  }
  
  const response = await fetch(`${API_BASE_URL}/tokens?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch tokens');
  }

  const data = await response.json();
  return {
    tokens: data.tokens || [],
    pagination: data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
  };
}

export async function getCreatorWalletsFromTokens(viewAll: boolean = false): Promise<string[]> {
  const params = new URLSearchParams();
  if (viewAll) {
    params.append('viewAll', 'true');
  }
  
  const response = await fetch(`${API_BASE_URL}/tokens/creators/list?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch creator wallets');
  }

  const data = await response.json();
  return data.creators || [];
}

export async function getTokenByMint(mint: string): Promise<Token> {
  const response = await fetch(`${API_BASE_URL}/tokens/${mint}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (response.status === 404) {
      throw new Error('Token not found');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch token');
  }

  const data = await response.json();
  return data.token;
}

