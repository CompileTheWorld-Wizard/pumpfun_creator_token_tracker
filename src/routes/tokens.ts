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
  timeBucketRugRates: Record<number, number>,
  settings: any,
  allWalletsData: Array<{ avgAthMcap: number | null; medianAthMcap: number | null }>
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
  
  // Average ATH MCap score
  if (avgAthMcap !== null && avgAthMcap > 0 && settings.avgAthMcap && avgAthMcapValues.length > 0) {
    const avgAthMcapRanges = getRanges(settings.avgAthMcap);
    if (avgAthMcapRanges.length > 0) {
      // Calculate percentile
      const percentile = calculatePercentile(avgAthMcap, avgAthMcapValues);
      avgAthMcapScore = getScoreFromRanges(percentile, avgAthMcapRanges);
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
  
  // Time Bucket Rug Rate score (always calculate, but only include in final score if enabled)
  if (settings.avgRugRateByTimeBucket) {
    const timeBucketRanges = getRanges(settings.avgRugRateByTimeBucket);
    if (timeBucketRanges.length > 0) {
      // Calculate average rug rate across all time buckets
      const timeBucketValues = Object.values(timeBucketRugRates);
      if (timeBucketValues.length > 0) {
        const avgTimeBucketRugRate = timeBucketValues.reduce((a, b) => a + b, 0) / timeBucketValues.length;
        timeBucketRugRateScore = getScoreFromRanges(avgTimeBucketRugRate, timeBucketRanges);
      }
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

// Calculate time bucket rug rate for streamed tokens
// Checks if token rugs within X seconds by examining market cap time series
function calculateTimeBucketRugRate(
  tokens: Array<{
    isFetched: boolean;
    createdAt: Date;
    marketCapTimeSeries: any;
    athMarketCapUsd: number | null;
  }>,
  timeBucketSeconds: number,
  rugThresholdMcap: number
): number {
  // Only consider streamed tokens (is_fetched = false)
  const streamedTokens = tokens.filter(t => !t.isFetched);
  
  if (streamedTokens.length === 0) return 0;
  
  let rugCount = 0;
  
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
    const timeBucketMs = timeBucketSeconds * 1000;
    const cutoffTime = createdAtMs + timeBucketMs;
    
    // Check if token rugs within the time bucket
    // A token rugs if its market cap drops below threshold within the time bucket
    const hasRugInBucket = marketCapTimeSeries.some((point: any) => {
      const pointTime = point.timestamp || point.time || 0;
      // Check if point is within the time bucket and market cap is below threshold
      return pointTime >= createdAtMs && pointTime <= cutoffTime && point.marketCapUsd < rugThresholdMcap;
    });
    
    if (hasRugInBucket) {
      rugCount++;
    }
  }
  
  return (rugCount / streamedTokens.length) * 100;
}

// Get creator wallets analytics with pagination
router.get('/creators/analytics', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const viewAll = req.query.viewAll === 'true' || req.query.viewAll === '1';
    
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
    
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT ct.creator) as total
       FROM tbl_soltrack_created_tokens ct
       ${whereClause}`
    );
    const total = parseInt(countResult.rows[0].total);
    
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
    
    // Get paginated creator wallets with statistics
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
      ORDER BY win_rate DESC, total_tokens DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
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
    
    // Extract time buckets from avgRugRateByTimeBucket ranges
    // Time buckets are the max values from each range (or min if max is not set)
    const timeBucketRanges = getRanges(scoringSettings?.avgRugRateByTimeBucket);
    const rugRateTimeBuckets: number[] = [];
    if (timeBucketRanges.length > 0) {
      // Extract unique time bucket values from ranges (use max value of each range)
      const bucketSet = new Set<number>();
      timeBucketRanges.forEach(range => {
        if (range.max !== undefined && range.max !== null) {
          bucketSet.add(range.max);
        } else if (range.min !== undefined && range.min !== null) {
          bucketSet.add(range.min);
        }
      });
      rugRateTimeBuckets.push(...Array.from(bucketSet).sort((a, b) => a - b));
    }
    // Fallback to default if no ranges configured
    if (rugRateTimeBuckets.length === 0) {
      rugRateTimeBuckets.push(1, 3, 5, 10);
    }
    
    // Calculate scores and create wallet objects
    const walletsWithScores = result.rows.map(row => {
      const winRate = parseFloat(row.win_rate) || 0;
      const avgAthMcap = row.avg_ath_mcap ? parseFloat(row.avg_ath_mcap) : null;
      const medianAthMcap = row.median_ath_mcap ? parseFloat(row.median_ath_mcap) : null;
      
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
      
      // Calculate time bucket rug rates (only for streamed tokens)
      const timeBucketRugRates: Record<number, number> = {};
      for (const timeBucket of rugRateTimeBuckets) {
        timeBucketRugRates[timeBucket] = calculateTimeBucketRugRate(
          allTokens,
          timeBucket,
          rugThresholdMcap
        );
      }
      
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
          timeBucketRugRates,
          scoringSettings, 
          allWalletsData
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
        validTokenCount,
        avgRugRate: Math.round(avgRugRate * 100) / 100,
        timeBucketRugRates: Object.fromEntries(
          Object.entries(timeBucketRugRates).map(([key, value]) => [
            parseFloat(key),
            Math.round(value * 100) / 100
          ])
        ),
        multiplierPercentages: multiplierPercentagesObj,
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
    
    // Sort by final score if scoring settings are available, otherwise keep original order
    const wallets = scoringSettings
      ? walletsWithScores.sort((a, b) => b.scores.finalScore - a.scores.finalScore)
      : walletsWithScores;
    
    res.json({
      wallets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
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


