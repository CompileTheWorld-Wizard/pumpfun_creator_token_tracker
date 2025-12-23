const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface CreatorWalletScores {
  winRateScore: number;
  avgAthMcapScore: number;
  medianAthMcapScore: number;
  multiplierScore: number;
  avgRugRateScore: number;
  timeBucketRugRateScore: number;
  individualMultiplierScores: Record<number, number>;
  finalScore: number;
}

export interface BuySellStats {
  avgBuyCount: number;
  avgBuyTotalSol: number;
  avgSellCount: number;
  avgSellTotalSol: number;
}

export interface ExpectedROI {
  avgRoi1stBuy: number;
  avgRoi2ndBuy: number;
  avgRoi3rdBuy: number;
}

export interface WhatIfPnl {
  avgPnl: number;
  avgPnlPercent: number;
  tokensSimulated: number;
}

export interface AthMcapPercentiles {
  percentile25th: boolean; // Whether creator has reached 25th percentile threshold
  percentile50th: boolean; // Whether creator has reached 50th percentile threshold
  percentile75th: boolean; // Whether creator has reached 75th percentile threshold
  percentile90th: boolean; // Whether creator has reached 90th percentile threshold
}

export interface CreatorWallet {
  address: string;
  totalTokens: number;
  bondedTokens: number;
  winRate: number; // % bonded (win rate)
  avgAthMcap: number | null;
  medianAthMcap: number | null;
  athMcapPercentileRank: number | null; // Percentile rank (0-100) of this creator's avg ATH compared to all creators
  athMcapPercentiles: AthMcapPercentiles;
  validTokenCount: number; // Tokens with both initial and ATH market cap > 0
  avgRugRate: number; // Overall rug rate (%)
  avgRugTime: number | null; // Average rug time in seconds (when tokens rug on average)
  multiplierPercentages: Record<number, number>; // % of tokens that reach each multiplier threshold
  buySellStats: BuySellStats;
  expectedROI: ExpectedROI;
  whatIfPnl: WhatIfPnl | null;
  scores: CreatorWalletScores;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreatorWalletsResponse {
  wallets: CreatorWallet[];
  pagination: PaginationInfo;
  totalTokens?: number; // Total token count from all filtered wallets
}

export interface FilterParams {
  totalTokens?: { min?: number; max?: number };
  bondedTokens?: { min?: number; max?: number };
  winRate?: Array<{
    type: 'percent' | 'score';
    min?: number;
    max?: number;
  }>;
  avgMcap?: Array<{
    type: 'mcap' | 'percentile' | 'score';
    min?: number;
    max?: number;
  }>;
  medianMcap?: Array<{
    type: 'mcap' | 'score';
    min?: number;
    max?: number;
  }>;
  avgBuySells?: Array<{
    type: 'buyCount' | 'buySol' | 'sellCount' | 'sellSol';
    min?: number;
    max?: number;
  }>;
  expectedROI?: Array<{
    type: '1st' | '2nd' | '3rd';
    min?: number;
    max?: number;
  }>;
  rugRate?: { min?: number; max?: number };
  avgRugTime?: { min?: number; max?: number };
  finalScore?: { min?: number; max?: number };
  multiplierScores?: Array<{
    multiplier: number;
    type: 'percent' | 'score';
    min?: number;
    max?: number;
  }>;
}

export interface WhatIfSettings {
  buyPosition: number; // Buy at position X after dev (e.g., 2 = 2nd buy after dev)
  sellStrategy: 'time' | 'pnl' | 'multiple';
  sellAtSeconds?: number; // Sell at X seconds
  sellAtPnlPercent?: number; // Sell if PNL >= X%
  multipleSells?: Array<{ type: 'time' | 'pnl'; value: number; sizePercent: number }>; // Multiple sells: [{type: 'time', value: 3, sizePercent: 50}, {type: 'pnl', value: 100, sizePercent: 50}]
}

export async function getCreatorWalletsAnalytics(
  page: number = 1,
  limit: number = 20,
  viewAll: boolean = false,
  filters?: FilterParams,
  whatIfSettings?: WhatIfSettings | null,
  sortColumn?: string | null,
  sortDirection?: 'asc' | 'desc'
): Promise<CreatorWalletsResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  
  if (viewAll) {
    params.append('viewAll', 'true');
  }
  
  if (sortColumn) {
    params.append('sortColumn', sortColumn);
  }
  
  if (sortDirection) {
    params.append('sortDirection', sortDirection);
  }

  // Add filters and What If settings to request body if provided
  const requestOptions: RequestInit = {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      filters: filters || {},
      whatIfSettings: whatIfSettings || null
    })
  };
  
  const response = await fetch(`${API_BASE_URL}/tokens/creators/analytics?${params.toString()}`, requestOptions);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch creator wallets analytics');
  }

  const data = await response.json();
  return {
    wallets: data.wallets || [],
    pagination: data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
    totalTokens: data.totalTokens || 0
  };
}

