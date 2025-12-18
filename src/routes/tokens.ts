import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db.js';

const router = Router();

// Get all created tokens with their 15-second market cap data
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const creatorWallet = req.query.creator as string || null;
    const viewAll = req.query.viewAll === 'true' || req.query.viewAll === '1';
    
    const offset = (page - 1) * limit;
    
    // Build WHERE clause
    let whereClause = '';
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    if (viewAll) {
      // Debug mode: show all tokens regardless of creator wallet
      if (creatorWallet) {
        whereClause = `WHERE ct.creator = $${paramIndex}`;
        queryParams.push(creatorWallet);
        paramIndex++;
      } else {
        whereClause = ''; // No filter, show all tokens
      }
    } else {
      // Normal mode: exclude blacklisted wallets (show tokens NOT from blacklisted wallets)
      whereClause = 'WHERE ct.creator NOT IN (SELECT wallet_address FROM tbl_soltrack_blacklist_creator)';
      
      if (creatorWallet) {
        whereClause += ` AND ct.creator = $${paramIndex}`;
        queryParams.push(creatorWallet);
        paramIndex++;
      }
    }
    
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM tbl_soltrack_created_tokens ct
       ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated tokens
    const result = await pool.query(
      `SELECT 
        ct.mint,
        ct.name,
        ct.symbol,
        ct.creator,
        ct.bonding_curve,
        ct.created_at,
        ct.create_tx_signature,
        ct.market_cap_time_series,
        ct.initial_market_cap_usd,
        ct.peak_market_cap_usd,
        ct.final_market_cap_usd,
        ct.trade_count_15s,
        ct.bonded,
        ct.ath_market_cap_usd,
        ct.tracked_at,
        ct.updated_at
      FROM tbl_soltrack_created_tokens ct
      ${whereClause}
      ORDER BY ct.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );
    
    const tokens = result.rows.map(row => {
      // Parse market_cap_time_series if it's a string, otherwise use as-is
      let marketCapTimeSeries = row.market_cap_time_series || [];
      if (typeof marketCapTimeSeries === 'string') {
        try {
          marketCapTimeSeries = JSON.parse(marketCapTimeSeries);
        } catch (e) {
          console.error('Error parsing market_cap_time_series:', e);
          marketCapTimeSeries = [];
        }
      }
      
      // Ensure it's an array
      if (!Array.isArray(marketCapTimeSeries)) {
        marketCapTimeSeries = [];
      }
      
      return {
        mint: row.mint,
        name: row.name,
        symbol: row.symbol,
        creator: row.creator,
        bondingCurve: row.bonding_curve,
        createdAt: row.created_at,
        createTxSignature: row.create_tx_signature,
        marketCapTimeSeries,
        initialMarketCapUsd: row.initial_market_cap_usd ? parseFloat(row.initial_market_cap_usd) : null,
        peakMarketCapUsd: row.peak_market_cap_usd ? parseFloat(row.peak_market_cap_usd) : null,
        finalMarketCapUsd: row.final_market_cap_usd ? parseFloat(row.final_market_cap_usd) : null,
        tradeCount15s: row.trade_count_15s || 0,
        bonded: row.bonded || false,
        athMarketCapUsd: row.ath_market_cap_usd ? parseFloat(row.ath_market_cap_usd) : null,
        trackedAt: row.tracked_at,
        updatedAt: row.updated_at,
      };
    });
    
    res.json({ 
      tokens,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching created tokens:', error);
    res.status(500).json({ 
      error: 'Error fetching created tokens' 
    });
  }
});

// Get a specific token by mint address
router.get('/:mint', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { mint } = req.params;
    
    const result = await pool.query(
      `SELECT 
        ct.mint,
        ct.name,
        ct.symbol,
        ct.creator,
        ct.bonding_curve,
        ct.created_at,
        ct.create_tx_signature,
        ct.market_cap_time_series,
        ct.initial_market_cap_usd,
        ct.peak_market_cap_usd,
        ct.final_market_cap_usd,
        ct.trade_count_15s,
        ct.bonded,
        ct.ath_market_cap_usd,
        ct.tracked_at,
        ct.updated_at
      FROM tbl_soltrack_created_tokens ct
      WHERE ct.mint = $1 
        AND ct.creator NOT IN (SELECT wallet_address FROM tbl_soltrack_blacklist_creator)
      LIMIT 1`,
      [mint]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }
    
    const row = result.rows[0];
    
    // Parse market_cap_time_series if it's a string, otherwise use as-is
    let marketCapTimeSeries = row.market_cap_time_series || [];
    if (typeof marketCapTimeSeries === 'string') {
      try {
        marketCapTimeSeries = JSON.parse(marketCapTimeSeries);
      } catch (e) {
        console.error('Error parsing market_cap_time_series:', e);
        marketCapTimeSeries = [];
      }
    }
    
    // Ensure it's an array
    if (!Array.isArray(marketCapTimeSeries)) {
      marketCapTimeSeries = [];
    }
    
    const token = {
      mint: row.mint,
      name: row.name,
      symbol: row.symbol,
      creator: row.creator,
      bondingCurve: row.bonding_curve,
      createdAt: row.created_at,
      createTxSignature: row.create_tx_signature,
      marketCapTimeSeries,
      initialMarketCapUsd: row.initial_market_cap_usd ? parseFloat(row.initial_market_cap_usd) : null,
      peakMarketCapUsd: row.peak_market_cap_usd ? parseFloat(row.peak_market_cap_usd) : null,
      finalMarketCapUsd: row.final_market_cap_usd ? parseFloat(row.final_market_cap_usd) : null,
      tradeCount15s: row.trade_count_15s || 0,
      bonded: row.bonded || false,
      athMarketCapUsd: row.ath_market_cap_usd ? parseFloat(row.ath_market_cap_usd) : null,
      trackedAt: row.tracked_at,
      updatedAt: row.updated_at,
    };
    
    res.json({ token });
  } catch (error: any) {
    console.error('Error fetching token:', error);
    res.status(500).json({ 
      error: 'Error fetching token' 
    });
  }
});

// Get distinct creator wallets from tbl_soltrack_created_tokens
router.get('/creators/list', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const viewAll = req.query.viewAll === 'true' || req.query.viewAll === '1';
    
    let query: string;
    let params: any[];
    
    if (viewAll) {
      // Show all creator wallets that have tokens
      query = `
        SELECT DISTINCT ct.creator as address
        FROM tbl_soltrack_created_tokens ct
        ORDER BY ct.creator ASC
      `;
      params = [];
    } else {
      // Show only creator wallets that have tokens AND are NOT blacklisted
      query = `
        SELECT DISTINCT ct.creator as address
        FROM tbl_soltrack_created_tokens ct
        WHERE ct.creator NOT IN (SELECT wallet_address FROM tbl_soltrack_blacklist_creator)
        ORDER BY ct.creator ASC
      `;
      params = [];
    }
    
    const result = await pool.query(query, params);
    
    res.json({ 
      creators: result.rows.map(row => row.address)
    });
  } catch (error: any) {
    console.error('Error fetching creator wallets:', error);
    res.status(500).json({ 
      error: 'Error fetching creator wallets' 
    });
  }
});

// Helper function to get score from ranges
function getScoreFromRanges(value: number, ranges: Array<{ min: number; max: number; score: number }>): number {
  for (const range of ranges) {
    if (value >= range.min && value <= range.max) {
      return range.score;
    }
  }
  return 0;
}

// Helper function to get ranges from metric (supports both old and new structure)
function getRanges(metric: any): Array<{ min: number; max: number; score: number }> {
  if (Array.isArray(metric)) {
    return metric; // Old structure
  }
  if (metric && typeof metric === 'object' && Array.isArray(metric.ranges)) {
    return metric.ranges; // New structure
  }
  return [];
}

// Calculate multiplier percentages for a creator's tokens
function calculateMultiplierPercentages(
  tokens: Array<{ initialMarketCapUsd: number | null; athMarketCapUsd: number | null }>
): Map<number, number> {
  const percentages = new Map<number, number>();
  
  // Define multiplier thresholds (sorted from highest to lowest for cumulative calculation)
  const thresholds = [10, 5, 3, 2, 1.5];
  
  // Filter tokens that have both initial and ATH market cap, excluding 0 market cap tokens
  const validTokens = tokens.filter(
    t => t.initialMarketCapUsd !== null && 
         t.initialMarketCapUsd > 0 && 
         t.athMarketCapUsd !== null && 
         t.athMarketCapUsd > 0
  );
  
  if (validTokens.length === 0) {
    // No valid tokens, return 0% for all thresholds
    thresholds.forEach(threshold => percentages.set(threshold, 0));
    return percentages;
  }
  
  // Calculate multiplier for each token: ATH market cap / initial market cap
  // This compares the all-time high against the starting (initial) market cap
  const multipliers = validTokens.map(t => {
    const initial = t.initialMarketCapUsd as number;
    const ath = t.athMarketCapUsd as number;
    return ath / initial;
  });
  
  // For each threshold, calculate percentage of tokens that reach at least that multiplier
  // This is cumulative: tokens that reach 2x also count for 1.5x
  thresholds.forEach(threshold => {
    const countReachingThreshold = multipliers.filter(m => m >= threshold).length;
    const percentage = (countReachingThreshold / validTokens.length) * 100;
    percentages.set(threshold, percentage);
  });
  
  return percentages;
}

// Calculate scores for each metric for a creator wallet
function calculateCreatorWalletScores(
  winRate: number,
  avgAthMcap: number | null,
  medianAthMcap: number | null,
  multiplierPercentages: Map<number, number>,
  avgRugRate: number,
  avgRugTime: number | null,
  settings: any,
  allWalletsData: Array<{ avgAthMcap: number | null; medianAthMcap: number | null }>,
  avgAthMcapPercentileRank: number | null = null
): {
  winRateScore: number;
  avgAthMcapScore: number;
  medianAthMcapScore: number;
  multiplierScore: number;
  individualMultiplierScores: Record<number, number>;
  avgRugRateScore: number;
  timeBucketRugRateScore: number;
  finalScore: number;
} {
  let winRateScore = 0;
  let avgAthMcapScore = 0;
  let medianAthMcapScore = 0;
  let multiplierScore = 0;
  let avgRugRateScore = 0;
  let timeBucketRugRateScore = 0;
  
  // Win Rate score
  const winRateRanges = getRanges(settings.winRate);
  if (winRateRanges.length > 0) {
    winRateScore = getScoreFromRanges(winRate, winRateRanges);
  }
  
  // Calculate percentiles for ATH MCap metrics
  const avgAthMcapValues = allWalletsData
    .map(w => w.avgAthMcap)
    .filter((v): v is number => v !== null && v > 0)
    .sort((a, b) => a - b);
  
  const medianAthMcapValues = allWalletsData
    .map(w => w.medianAthMcap)
    .filter((v): v is number => v !== null && v > 0)
    .sort((a, b) => a - b);
  
  // Average ATH MCap score (based on percentile rank)
  if (settings.avgAthMcap) {
    const avgAthMcapRanges = getRanges(settings.avgAthMcap);
    if (avgAthMcapRanges.length > 0) {
      // Use provided percentile rank if available, otherwise calculate it
      let percentile: number | null = avgAthMcapPercentileRank;
      if (percentile === null && avgAthMcap !== null && avgAthMcap > 0 && avgAthMcapValues.length > 0) {
        percentile = calculatePercentile(avgAthMcap, avgAthMcapValues);
      }
      if (percentile !== null) {
        avgAthMcapScore = getScoreFromRanges(percentile, avgAthMcapRanges);
      }
    }
  }
  
  // Median ATH MCap score
  if (medianAthMcap !== null && medianAthMcap > 0 && settings.medianAthMcap && medianAthMcapValues.length > 0) {
    const medianAthMcapRanges = getRanges(settings.medianAthMcap);
    if (medianAthMcapRanges.length > 0) {
      // Calculate percentile
      const percentile = calculatePercentile(medianAthMcap, medianAthMcapValues);
      medianAthMcapScore = getScoreFromRanges(percentile, medianAthMcapRanges);
    }
  }
  
  // Multiplier scores (cumulative) - track individual scores
  const individualMultiplierScores: Map<number, number> = new Map();
  
  if (settings.multiplierConfigs && Array.isArray(settings.multiplierConfigs)) {
    settings.multiplierConfigs.forEach((config: any) => {
      if (config.multiplier && config.ranges && Array.isArray(config.ranges)) {
        const percentage = multiplierPercentages.get(config.multiplier) || 0;
        const score = getScoreFromRanges(percentage, config.ranges);
        individualMultiplierScores.set(config.multiplier, score);
        multiplierScore += score;
      }
    });
  }
  
  // Average Rug Rate score
  const avgRugRateRanges = getRanges(settings.avgRugRate);
  if (avgRugRateRanges.length > 0) {
    avgRugRateScore = getScoreFromRanges(avgRugRate, avgRugRateRanges);
  }
  
  // Average Rug Time score (always calculate, but only include in final score if enabled)
  if (settings.avgRugRateByTimeBucket && avgRugTime !== null && avgRugTime >= 0) {
    const timeBucketRanges = getRanges(settings.avgRugRateByTimeBucket);
    if (timeBucketRanges.length > 0) {
      // Use average rug time (in seconds) to get score from ranges
      timeBucketRugRateScore = getScoreFromRanges(avgRugTime, timeBucketRanges);
    }
  }
  
  // Only include time bucket rug rate score in final score if enabled
  const finalScore = winRateScore + avgAthMcapScore + medianAthMcapScore + multiplierScore + avgRugRateScore + 
    (settings.includeTimeBucketRugRate ? timeBucketRugRateScore : 0);
  
  return {
    winRateScore,
    avgAthMcapScore,
    medianAthMcapScore,
    multiplierScore,
    individualMultiplierScores: Object.fromEntries(individualMultiplierScores),
    avgRugRateScore,
    timeBucketRugRateScore,
    finalScore
  };
}

// Calculate percentile for a value in a sorted array
function calculatePercentile(value: number, sortedArray: number[]): number {
  if (sortedArray.length === 0) return 0;
  if (sortedArray.length === 1) return value >= sortedArray[0] ? 100 : 0;
  
  let countBelow = 0;
  for (const item of sortedArray) {
    if (item < value) {
      countBelow++;
    } else {
      break;
    }
  }
  
  return (countBelow / sortedArray.length) * 100;
}

// Calculate overall rug rate: (# tokens that rug / # created) where rug = ATH < X mcap
function calculateRugRate(
  tokens: Array<{ athMarketCapUsd: number | null }>,
  rugThresholdMcap: number
): number {
  if (tokens.length === 0) return 0;
  
  const rugCount = tokens.filter(t => {
    const ath = t.athMarketCapUsd;
    return ath !== null && ath < rugThresholdMcap;
  }).length;
  
  return (rugCount / tokens.length) * 100;
}

// Calculate average rug time for streamed tokens
// Returns the average time (in seconds) when tokens rug (market cap drops below threshold)
function calculateAvgRugTime(
  tokens: Array<{
    isFetched: boolean;
    createdAt: Date;
    marketCapTimeSeries: any;
    athMarketCapUsd: number | null;
  }>,
  rugThresholdMcap: number
): number | null {
  // Only consider streamed tokens (is_fetched = false)
  const streamedTokens = tokens.filter(t => !t.isFetched);
  
  if (streamedTokens.length === 0) return null;
  
  const rugTimes: number[] = [];
  
  for (const token of streamedTokens) {
    // Check if token has market cap time series data
    let marketCapTimeSeries = token.marketCapTimeSeries;
    if (typeof marketCapTimeSeries === 'string') {
      try {
        marketCapTimeSeries = JSON.parse(marketCapTimeSeries);
      } catch (e) {
        continue; // Skip if can't parse
      }
    }
    
    if (!Array.isArray(marketCapTimeSeries) || marketCapTimeSeries.length === 0) {
      continue; // Skip if no time series data
    }
    
    // Get token creation time
    const createdAtMs = new Date(token.createdAt).getTime();
    
    // Find the first point where market cap drops below threshold
    // Sort by timestamp to ensure chronological order
    const sortedPoints = marketCapTimeSeries
      .map((point: any) => ({
        timestamp: point.timestamp || point.time || 0,
        marketCapUsd: point.marketCapUsd || point.market_cap_usd || 0
      }))
      .filter((point: any) => point.timestamp >= createdAtMs) // Only points after creation
      .sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp
    
    // Find first point where market cap is below threshold
    for (const point of sortedPoints) {
      if (point.marketCapUsd < rugThresholdMcap && point.marketCapUsd > 0) {
        // Calculate time in seconds from creation
        const rugTimeSeconds = (point.timestamp - createdAtMs) / 1000;
        if (rugTimeSeconds >= 0) {
          rugTimes.push(rugTimeSeconds);
        }
        break; // Only count the first rug time
      }
    }
  }
  
  // Calculate average rug time
  if (rugTimes.length === 0) {
    return null; // No tokens rugs found
  }
  
  const avgRugTime = rugTimes.reduce((a, b) => a + b, 0) / rugTimes.length;
  return avgRugTime;
}

// Calculate expected ROI for 1st/2nd/3rd buy positions
function calculateExpectedROI(
  tokens: Array<{
    marketCapTimeSeries: any;
    athMarketCapUsd: number | null;
  }>
): {
  avgRoi1stBuy: number;
  avgRoi2ndBuy: number;
  avgRoi3rdBuy: number;
} {
  const DEFAULT_TOKEN_SUPPLY = 1_000_000_000; // 1 billion tokens
  
  if (tokens.length === 0) {
    return {
      avgRoi1stBuy: 0,
      avgRoi2ndBuy: 0,
      avgRoi3rdBuy: 0
    };
  }
  
  let totalRoi1st = 0;
  let totalRoi2nd = 0;
  let totalRoi3rd = 0;
  let tokensWith1stBuy = 0;
  let tokensWith2ndBuy = 0;
  let tokensWith3rdBuy = 0;
  
  for (const token of tokens) {
    // Skip if no ATH market cap
    if (!token.athMarketCapUsd || token.athMarketCapUsd <= 0) {
      continue;
    }
    
    // Parse market cap time series
    let marketCapTimeSeries = token.marketCapTimeSeries;
    if (typeof marketCapTimeSeries === 'string') {
      try {
        marketCapTimeSeries = JSON.parse(marketCapTimeSeries);
      } catch (e) {
        continue; // Skip if can't parse
      }
    }
    
    if (!Array.isArray(marketCapTimeSeries) || marketCapTimeSeries.length === 0) {
      continue; // Skip if no time series data
    }
    
    // Filter only buy transactions and get them in order
    const buyTrades = marketCapTimeSeries
      .filter((point: any) => {
        const tradeType = point.tradeType || point.trade_type;
        return tradeType === 'buy' && 
               point.executionPriceSol !== undefined && 
               point.executionPriceSol !== null &&
               point.executionPriceSol > 0;
      })
      .map((point: any) => ({
        executionPriceSol: point.executionPriceSol || point.execution_price_sol || 0,
        timestamp: point.timestamp || point.time || 0
      }))
      .sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp to get order
    
    // Need at least 1 buy to calculate ROI
    if (buyTrades.length === 0) {
      continue;
    }
    
    // Find the execution price at ATH from the time series
    // Look for the point with the highest market cap in the time series
    let priceAtAthSol: number | null = null;
    let maxMarketCapUsd = 0;
    
    for (const point of marketCapTimeSeries) {
      const marketCapUsd = point.marketCapUsd || point.market_cap_usd || 0;
      const executionPriceSol = point.executionPriceSol || point.execution_price_sol;
      
      if (marketCapUsd > maxMarketCapUsd && executionPriceSol !== undefined && executionPriceSol !== null && executionPriceSol > 0) {
        maxMarketCapUsd = marketCapUsd;
        priceAtAthSol = executionPriceSol;
      }
    }
    
    // If ATH is higher than what's in time series, calculate price from ATH market cap
    // We need SOL price to convert, but we'll use the SOL price from the highest point
    // If we can't find a price in time series, skip this token
    if (!priceAtAthSol || priceAtAthSol <= 0) {
      // Fallback: calculate from ATH market cap if we have SOL price
      // Find any point with SOL price for conversion
      let solPriceUsd = 0;
      for (const point of marketCapTimeSeries) {
        const price = point.solPriceUsd || point.sol_price_usd;
        if (price && price > 0) {
          solPriceUsd = price;
          break;
        }
      }
      
      if (solPriceUsd > 0) {
        // Convert ATH market cap USD to SOL, then to price per token
        const athMarketCapSol = token.athMarketCapUsd / solPriceUsd;
        priceAtAthSol = athMarketCapSol / DEFAULT_TOKEN_SUPPLY;
      } else {
        continue; // Skip if we can't calculate
      }
    }
    
    // Calculate ROI for each position
    // ROI = (sell_price - buy_price) / buy_price * 100
    if (buyTrades.length >= 1 && priceAtAthSol > 0) {
      const buyPrice1st = buyTrades[0].executionPriceSol;
      if (buyPrice1st > 0) {
        const roi1st = ((priceAtAthSol - buyPrice1st) / buyPrice1st) * 100;
        totalRoi1st += roi1st;
        tokensWith1stBuy++;
      }
    }
    
    if (buyTrades.length >= 2 && priceAtAthSol > 0) {
      const buyPrice2nd = buyTrades[1].executionPriceSol;
      if (buyPrice2nd > 0) {
        const roi2nd = ((priceAtAthSol - buyPrice2nd) / buyPrice2nd) * 100;
        totalRoi2nd += roi2nd;
        tokensWith2ndBuy++;
      }
    }
    
    if (buyTrades.length >= 3 && priceAtAthSol > 0) {
      const buyPrice3rd = buyTrades[2].executionPriceSol;
      if (buyPrice3rd > 0) {
        const roi3rd = ((priceAtAthSol - buyPrice3rd) / buyPrice3rd) * 100;
        totalRoi3rd += roi3rd;
        tokensWith3rdBuy++;
      }
    }
  }
  
  // Calculate averages
  const avgRoi1stBuy = tokensWith1stBuy > 0 ? totalRoi1st / tokensWith1stBuy : 0;
  const avgRoi2ndBuy = tokensWith2ndBuy > 0 ? totalRoi2nd / tokensWith2ndBuy : 0;
  const avgRoi3rdBuy = tokensWith3rdBuy > 0 ? totalRoi3rd / tokensWith3rdBuy : 0;
  
  return {
    avgRoi1stBuy: Math.round(avgRoi1stBuy * 100) / 100,
    avgRoi2ndBuy: Math.round(avgRoi2ndBuy * 100) / 100,
    avgRoi3rdBuy: Math.round(avgRoi3rdBuy * 100) / 100
  };
}

// Calculate average buy/sell statistics for a creator wallet
function calculateBuySellStats(
  tokens: Array<{
    marketCapTimeSeries: any;
  }>
): {
  avgBuyCount: number;
  avgBuyTotalSol: number;
  avgSellCount: number;
  avgSellTotalSol: number;
} {
  if (tokens.length === 0) {
    return {
      avgBuyCount: 0,
      avgBuyTotalSol: 0,
      avgSellCount: 0,
      avgSellTotalSol: 0
    };
  }
  
  let totalBuyCount = 0;
  let totalBuySol = 0;
  let totalSellCount = 0;
  let totalSellSol = 0;
  let tokensWithData = 0;
  
  for (const token of tokens) {
    // Parse market cap time series
    let marketCapTimeSeries = token.marketCapTimeSeries;
    if (typeof marketCapTimeSeries === 'string') {
      try {
        marketCapTimeSeries = JSON.parse(marketCapTimeSeries);
      } catch (e) {
        continue; // Skip if can't parse
      }
    }
    
    if (!Array.isArray(marketCapTimeSeries) || marketCapTimeSeries.length === 0) {
      continue; // Skip if no time series data
    }
    
    tokensWithData++;
    
    // Count buys and sells, and sum SOL amounts
    let buyCount = 0;
    let buySol = 0;
    let sellCount = 0;
    let sellSol = 0;
    
    for (const point of marketCapTimeSeries) {
      const tradeType = point.tradeType || point.trade_type;
      // Use solAmount (actual SOL amount for the trade) - this is required for accurate calculations
      // Old data might not have solAmount, so we skip those trades
      const solAmount = point.solAmount !== undefined ? point.solAmount : 
                       (point.sol_amount !== undefined ? point.sol_amount : null);
      
      // Skip trades without solAmount (old data format)
      if (solAmount === null || solAmount === undefined) {
        continue;
      }
      
      if (tradeType === 'buy') {
        buyCount++;
        buySol += solAmount;
      } else if (tradeType === 'sell') {
        sellCount++;
        sellSol += solAmount;
      }
    }
    
    totalBuyCount += buyCount;
    totalBuySol += buySol;
    totalSellCount += sellCount;
    totalSellSol += sellSol;
  }
  
  // Calculate averages
  const avgBuyCount = tokensWithData > 0 ? totalBuyCount / tokensWithData : 0;
  const avgBuyTotalSol = tokensWithData > 0 ? totalBuySol / tokensWithData : 0;
  const avgSellCount = tokensWithData > 0 ? totalSellCount / tokensWithData : 0;
  const avgSellTotalSol = tokensWithData > 0 ? totalSellSol / tokensWithData : 0;
  
  return {
    avgBuyCount: Math.round(avgBuyCount * 100) / 100,
    avgBuyTotalSol: Math.round(avgBuyTotalSol * 100) / 100,
    avgSellCount: Math.round(avgSellCount * 100) / 100,
    avgSellTotalSol: Math.round(avgSellTotalSol * 100) / 100
  };
}

// Get creator wallets analytics with pagination
router.post('/creators/analytics', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const viewAll = req.query.viewAll === 'true' || req.query.viewAll === '1';
    const filters = req.body?.filters || {};
    
    const offset = (page - 1) * limit;
    
    // Get applied scoring settings
    let scoringSettings: any = null;
    try {
      const settingsResult = await pool.query(
        `SELECT settings
         FROM tbl_soltrack_applied_settings
         ORDER BY applied_at DESC
         LIMIT 1`
      );
      
      if (settingsResult.rows.length === 0) {
        // Get default preset
        const defaultResult = await pool.query(
          `SELECT settings
           FROM tbl_soltrack_scoring_settings
           WHERE is_default = TRUE
           LIMIT 1`
        );
        if (defaultResult.rows.length > 0) {
          scoringSettings = defaultResult.rows[0].settings;
        }
      } else {
        scoringSettings = settingsResult.rows[0].settings;
      }
    } catch (settingsError) {
      console.error('Error fetching scoring settings:', settingsError);
      // Continue without scoring if settings can't be loaded
    }
    
    // Build WHERE clause
    let whereClause = '';
    if (!viewAll) {
      whereClause = 'WHERE ct.creator NOT IN (SELECT wallet_address FROM tbl_soltrack_blacklist_creator)';
    }
    
    // Get rug threshold from settings (default 6000) - need this early for calculations
    const rugThresholdMcap = scoringSettings?.rugThresholdMcap || 6000;
    
    // First, get ALL wallets data to calculate percentiles (not just paginated ones)
    const allWalletsResult = await pool.query(
      `SELECT 
        ct.creator,
        AVG(ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL) as avg_ath_mcap,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL AND ct.ath_market_cap_usd > 0) as median_ath_mcap
      FROM tbl_soltrack_created_tokens ct
      ${whereClause}
      GROUP BY ct.creator`
    );
    
    const allWalletsData = allWalletsResult.rows.map(row => ({
      avgAthMcap: row.avg_ath_mcap ? parseFloat(row.avg_ath_mcap) : null,
      medianAthMcap: row.median_ath_mcap ? parseFloat(row.median_ath_mcap) : null
    }));
    
    // Get ALL creator wallets with statistics (we'll filter and paginate after)
    const result = await pool.query(
      `SELECT 
        ct.creator as address,
        COUNT(*) as total_tokens,
        COUNT(*) FILTER (WHERE ct.bonded = true) as bonded_tokens,
        CASE 
          WHEN COUNT(*) > 0 THEN 
            ROUND((COUNT(*) FILTER (WHERE ct.bonded = true)::DECIMAL / COUNT(*)::DECIMAL) * 100, 2)
          ELSE 0
        END as win_rate,
        AVG(ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL) as avg_ath_mcap,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL AND ct.ath_market_cap_usd > 0) as median_ath_mcap
      FROM tbl_soltrack_created_tokens ct
      ${whereClause}
      GROUP BY ct.creator
      ORDER BY win_rate DESC, total_tokens DESC`
    );
    
    // Get token data for multiplier and rug rate calculations for the paginated creators
    const creatorAddresses = result.rows.map(row => row.address);
    let tokensByCreator: Map<string, Array<{ initialMarketCapUsd: number | null; athMarketCapUsd: number | null }>> = new Map();
    let allTokensByCreator: Map<string, Array<{ 
      athMarketCapUsd: number | null;
      isFetched: boolean;
      createdAt: Date;
      marketCapTimeSeries: any;
    }>> = new Map();
    
    if (creatorAddresses.length > 0) {
      // Build WHERE clause for token query (same filter as main query)
      let tokenWhereClause = 'WHERE ct.creator = ANY($1::text[])';
      if (!viewAll) {
        tokenWhereClause += ' AND ct.creator NOT IN (SELECT wallet_address FROM tbl_soltrack_blacklist_creator)';
      }
      
      // Get tokens for multiplier calculations (valid tokens only)
      const tokensResult = await pool.query(
        `SELECT 
          ct.creator,
          ct.initial_market_cap_usd,
          ct.ath_market_cap_usd
        FROM tbl_soltrack_created_tokens ct
        ${tokenWhereClause}
        AND ct.initial_market_cap_usd IS NOT NULL
        AND ct.initial_market_cap_usd > 0
        AND ct.ath_market_cap_usd IS NOT NULL
        AND ct.ath_market_cap_usd > 0`,
        [creatorAddresses]
      );
      
      // Group tokens by creator for multiplier calculations
      tokensResult.rows.forEach(row => {
        const creator = row.creator;
        if (!tokensByCreator.has(creator)) {
          tokensByCreator.set(creator, []);
        }
        tokensByCreator.get(creator)!.push({
          initialMarketCapUsd: row.initial_market_cap_usd ? parseFloat(row.initial_market_cap_usd) : null,
          athMarketCapUsd: row.ath_market_cap_usd ? parseFloat(row.ath_market_cap_usd) : null
        });
      });
      
      // Get ALL tokens for rug rate calculations (including invalid ones)
      const allTokensResult = await pool.query(
        `SELECT 
          ct.creator,
          ct.ath_market_cap_usd,
          ct.is_fetched,
          ct.created_at,
          ct.market_cap_time_series
        FROM tbl_soltrack_created_tokens ct
        ${tokenWhereClause}`,
        [creatorAddresses]
      );
      
      // Group all tokens by creator for rug rate calculations
      allTokensResult.rows.forEach(row => {
        const creator = row.creator;
        if (!allTokensByCreator.has(creator)) {
          allTokensByCreator.set(creator, []);
        }
        allTokensByCreator.get(creator)!.push({
          athMarketCapUsd: row.ath_market_cap_usd ? parseFloat(row.ath_market_cap_usd) : null,
          isFetched: row.is_fetched || false,
          createdAt: row.created_at,
          marketCapTimeSeries: row.market_cap_time_series
        });
      });
    }
    
    // No need to extract time buckets - we're calculating average rug time instead
    
    // Calculate percentile rank for each creator's avg ATH compared to all creators
    // Get all avg ATH values and sort them
    const allAvgAthValues = allWalletsData
      .map(w => w.avgAthMcap)
      .filter((v): v is number => v !== null && v > 0)
      .sort((a, b) => a - b);
    
    // Calculate scores and create wallet objects
    const walletsWithScores = result.rows.map(row => {
      const winRate = parseFloat(row.win_rate) || 0;
      const avgAthMcap = row.avg_ath_mcap ? parseFloat(row.avg_ath_mcap) : null;
      const medianAthMcap = row.median_ath_mcap ? parseFloat(row.median_ath_mcap) : null;
      
      // Calculate percentile rank of this creator's avg ATH compared to all creators
      // This shows where this creator ranks among all creators (0-100)
      // Lower percentile = lower avg ATH (worse performance)
      // Higher percentile = higher avg ATH (better performance)
      let percentileRank: number | null = null;
      if (avgAthMcap !== null && avgAthMcap > 0 && allAvgAthValues.length > 0) {
        percentileRank = calculatePercentile(avgAthMcap, allAvgAthValues);
      }
      
      // Determine which percentile thresholds this creator has reached
      // If at 20th percentile (bottom 20%), they're in the 25th percentile bucket
      // If at 60th percentile, they're in the 75th and 90th percentile buckets
      // Show checkmarks/indicators for which thresholds they've reached
      let percentile25th: boolean = false;
      let percentile50th: boolean = false;
      let percentile75th: boolean = false;
      let percentile90th: boolean = false;
      
      if (percentileRank !== null) {
        // Determine which percentile bucket this creator falls into
        // If in bottom 25% (percentile rank <= 25), show 25th percentile
        // If in bottom 50% (percentile rank <= 50), show 50th percentile  
        // If in bottom 75% (percentile rank <= 75), show 75th percentile
        // If in bottom 90% (percentile rank <= 90), show 90th percentile
        // If in top 10% (percentile rank > 90), show 90th percentile (they've exceeded it)
        // Show cumulative: if at 60th percentile, they're in 75th and 90th buckets
        if (percentileRank <= 25) {
          percentile25th = true;
        } else if (percentileRank <= 50) {
          percentile25th = true;
          percentile50th = true;
        } else if (percentileRank <= 75) {
          percentile25th = true;
          percentile50th = true;
          percentile75th = true;
        } else {
          // percentileRank > 75, they've reached all thresholds
          percentile25th = true;
          percentile50th = true;
          percentile75th = true;
          percentile90th = true;
        }
      }
      
      // Get tokens for this creator and calculate multiplier percentages
      const tokens = tokensByCreator.get(row.address) || [];
      const multiplierPercentages = calculateMultiplierPercentages(tokens);
      
      // Count valid tokens (tokens with both initial and ATH market cap > 0)
      const validTokenCount = tokens.filter(
        t => t.initialMarketCapUsd !== null && 
             t.initialMarketCapUsd > 0 && 
             t.athMarketCapUsd !== null && 
             t.athMarketCapUsd > 0
      ).length;
      
      // Get all tokens for rug rate calculations
      const allTokens = allTokensByCreator.get(row.address) || [];
      
      // Calculate overall rug rate
      const avgRugRate = calculateRugRate(allTokens, rugThresholdMcap);
      
      // Calculate average rug time (only for streamed tokens)
      const avgRugTime = calculateAvgRugTime(allTokens, rugThresholdMcap);
      
      // Calculate buy/sell statistics
      const buySellStats = calculateBuySellStats(allTokens);
      
      // Calculate expected ROI for 1st/2nd/3rd buy positions
      const expectedROI = calculateExpectedROI(allTokens);
      
      // Calculate scores if settings are available
      let scores = {
        winRateScore: 0,
        avgAthMcapScore: 0,
        medianAthMcapScore: 0,
        multiplierScore: 0,
        avgRugRateScore: 0,
        timeBucketRugRateScore: 0,
        individualMultiplierScores: {} as Record<number, number>,
        finalScore: 0
      };
      
      if (scoringSettings) {
        scores = calculateCreatorWalletScores(
          winRate, 
          avgAthMcap, 
          medianAthMcap, 
          multiplierPercentages,
          avgRugRate,
          avgRugTime,
          scoringSettings, 
          allWalletsData,
          percentileRank
        );
      }
      
      // Convert multiplier percentages Map to object
      const multiplierPercentagesObj = Object.fromEntries(
        Array.from(multiplierPercentages.entries()).map(([key, value]) => [
          key,
          Math.round(value * 100) / 100
        ])
      );
      
      return {
        address: row.address,
        totalTokens: parseInt(row.total_tokens) || 0,
        bondedTokens: parseInt(row.bonded_tokens) || 0,
        winRate,
        avgAthMcap,
        medianAthMcap,
        athMcapPercentileRank: percentileRank !== null ? Math.round(percentileRank * 100) / 100 : null,
        athMcapPercentiles: {
          percentile25th,
          percentile50th,
          percentile75th,
          percentile90th
        },
        validTokenCount,
        avgRugRate: Math.round(avgRugRate * 100) / 100,
        avgRugTime: avgRugTime !== null ? Math.round(avgRugTime * 100) / 100 : null,
        multiplierPercentages: multiplierPercentagesObj,
        buySellStats: {
          avgBuyCount: buySellStats.avgBuyCount,
          avgBuyTotalSol: buySellStats.avgBuyTotalSol,
          avgSellCount: buySellStats.avgSellCount,
          avgSellTotalSol: buySellStats.avgSellTotalSol
        },
        expectedROI: {
          avgRoi1stBuy: expectedROI.avgRoi1stBuy,
          avgRoi2ndBuy: expectedROI.avgRoi2ndBuy,
          avgRoi3rdBuy: expectedROI.avgRoi3rdBuy
        },
        scores: {
          winRateScore: Math.round(scores.winRateScore * 100) / 100,
          avgAthMcapScore: Math.round(scores.avgAthMcapScore * 100) / 100,
          medianAthMcapScore: Math.round(scores.medianAthMcapScore * 100) / 100,
          multiplierScore: Math.round(scores.multiplierScore * 100) / 100,
          avgRugRateScore: Math.round(scores.avgRugRateScore * 100) / 100,
          timeBucketRugRateScore: Math.round(scores.timeBucketRugRateScore * 100) / 100,
          individualMultiplierScores: Object.fromEntries(
            Object.entries(scores.individualMultiplierScores).map(([key, value]) => [
              parseFloat(key),
              Math.round(value * 100) / 100
            ])
          ),
          finalScore: Math.round(scores.finalScore * 100) / 100
        }
      };
    });
    
    // Apply filters if provided
    let filteredWallets = walletsWithScores;
    
    if (filters && Object.keys(filters).length > 0) {
      filteredWallets = walletsWithScores.filter(wallet => {
        // Filter by total tokens
        if (filters.totalTokens) {
          if (filters.totalTokens.min !== undefined && wallet.totalTokens < filters.totalTokens.min) {
            return false;
          }
          if (filters.totalTokens.max !== undefined && wallet.totalTokens > filters.totalTokens.max) {
            return false;
          }
        }
        
        // Filter by bonded tokens
        if (filters.bondedTokens) {
          if (filters.bondedTokens.min !== undefined && wallet.bondedTokens < filters.bondedTokens.min) {
            return false;
          }
          if (filters.bondedTokens.max !== undefined && wallet.bondedTokens > filters.bondedTokens.max) {
            return false;
          }
        }
        
        // Filter by win rate (all filters must match - AND logic)
        if (filters.winRate && Array.isArray(filters.winRate) && filters.winRate.length > 0) {
          for (const filter of filters.winRate) {
            if (filter.type === 'percent') {
              const matches = (
                (filter.min === undefined || wallet.winRate >= filter.min) &&
                (filter.max === undefined || wallet.winRate <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === 'score') {
              const matches = (
                (filter.min === undefined || wallet.scores.winRateScore >= filter.min) &&
                (filter.max === undefined || wallet.scores.winRateScore <= filter.max)
              );
              if (!matches) return false;
            }
          }
        }
        
        // Filter by average market cap (all filters must match - AND logic)
        if (filters.avgMcap && Array.isArray(filters.avgMcap) && filters.avgMcap.length > 0) {
          for (const filter of filters.avgMcap) {
            if (filter.type === 'mcap') {
              if (wallet.avgAthMcap === null) return false;
              const matches = (
                (filter.min === undefined || wallet.avgAthMcap >= filter.min) &&
                (filter.max === undefined || wallet.avgAthMcap <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === 'percentile') {
              if (wallet.athMcapPercentileRank === null) return false;
              const matches = (
                (filter.min === undefined || wallet.athMcapPercentileRank >= filter.min) &&
                (filter.max === undefined || wallet.athMcapPercentileRank <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === 'score') {
              const matches = (
                (filter.min === undefined || wallet.scores.avgAthMcapScore >= filter.min) &&
                (filter.max === undefined || wallet.scores.avgAthMcapScore <= filter.max)
              );
              if (!matches) return false;
            }
          }
        }
        
        // Filter by median market cap (all filters must match - AND logic)
        if (filters.medianMcap && Array.isArray(filters.medianMcap) && filters.medianMcap.length > 0) {
          for (const filter of filters.medianMcap) {
            if (filter.type === 'mcap') {
              if (wallet.medianAthMcap === null) return false;
              const matches = (
                (filter.min === undefined || wallet.medianAthMcap >= filter.min) &&
                (filter.max === undefined || wallet.medianAthMcap <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === 'score') {
              const matches = (
                (filter.min === undefined || wallet.scores.medianAthMcapScore >= filter.min) &&
                (filter.max === undefined || wallet.scores.medianAthMcapScore <= filter.max)
              );
              if (!matches) return false;
            }
          }
        }
        
        return true;
      });
    }
    
    // Sort by final score if scoring settings are available, otherwise keep original order
    const wallets = scoringSettings
      ? filteredWallets.sort((a, b) => b.scores.finalScore - a.scores.finalScore)
      : filteredWallets;
    
    // Recalculate total count after filtering
    const filteredTotal = wallets.length;
    
    // Apply pagination to filtered results
    const paginatedWallets = wallets.slice(offset, offset + limit);
    
    res.json({
      wallets: paginatedWallets,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        totalPages: Math.ceil(filteredTotal / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching creator wallets analytics:', error);
    res.status(500).json({
      error: 'Error fetching creator wallets analytics'
    });
  }
});

export default router;


