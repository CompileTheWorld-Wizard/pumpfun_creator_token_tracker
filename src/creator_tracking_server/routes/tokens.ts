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
    
    // Parse sorting parameters
    const sortColumn = req.query.sortColumn as string || 'created_at';
    const sortDirection = req.query.sortDirection as string || 'desc';
    
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
    
    // Validate and build ORDER BY clause
    const validSortColumns: Record<string, string> = {
      'name': 'ct.name',
      'symbol': 'ct.symbol',
      'creator': 'ct.creator',
      'status': 'ct.bonded',
      'initialMC': 'ct.initial_market_cap_usd',
      'peakMC': 'ct.peak_market_cap_usd',
      'finalMC': 'ct.final_market_cap_usd',
      'athMC': 'ct.ath_market_cap_usd',
      'trades': 'ct.trade_count_15s',
      'created': 'ct.created_at'
    };
    
    const validSortDirection = sortDirection.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const dbSortColumn = validSortColumns[sortColumn] || 'ct.created_at';
    const orderByClause = `ORDER BY ${dbSortColumn} ${validSortDirection}`;
    
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
      ${orderByClause}
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

// Get overall ATH mcap statistics for all creator wallets
router.get('/creators/ath-stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const viewAll = req.query.viewAll === 'true' || req.query.viewAll === '1';
    
    let whereClause = '';
    if (!viewAll) {
      // Normal mode: exclude blacklisted wallets
      whereClause = 'WHERE ct.creator NOT IN (SELECT wallet_address FROM tbl_soltrack_blacklist_creator)';
    }
    
    // Calculate average and median ATH mcap across all creator wallets
    // First, get the average ATH mcap per creator wallet
    const result = await pool.query(
      `SELECT 
        AVG(ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL) as avg_ath_mcap
      FROM tbl_soltrack_created_tokens ct
      ${whereClause}`
    );
    
    // Get median ATH mcap across all tokens
    const medianResult = await pool.query(
      `SELECT 
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL AND ct.ath_market_cap_usd > 0) as median_ath_mcap
      FROM tbl_soltrack_created_tokens ct
      ${whereClause}`
    );
    
    const avgAthMcap = result.rows[0]?.avg_ath_mcap ? parseFloat(result.rows[0].avg_ath_mcap) : null;
    const medianAthMcap = medianResult.rows[0]?.median_ath_mcap ? parseFloat(medianResult.rows[0].median_ath_mcap) : null;
    
    res.json({
      avgAthMcap,
      medianAthMcap
    });
  } catch (error: any) {
    console.error('Error fetching ATH mcap statistics:', error);
    res.status(500).json({ 
      error: 'Error fetching ATH mcap statistics' 
    });
  }
});

// Get overall average metrics for all creator wallets
router.get('/creators/avg-stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const viewAll = req.query.viewAll === 'true' || req.query.viewAll === '1';
    
    let whereClause = '';
    if (!viewAll) {
      // Normal mode: exclude blacklisted wallets
      whereClause = 'WHERE ct.creator NOT IN (SELECT wallet_address FROM tbl_soltrack_blacklist_creator)';
    }
    
    // Get basic statistics that can be calculated directly from database
    const basicStatsResult = await pool.query(
      `SELECT 
        AVG(wallet_stats.total_tokens) as avg_total_tokens,
        AVG(wallet_stats.bonded_tokens) as avg_bonded_tokens,
        AVG(wallet_stats.win_rate) as avg_win_rate,
        AVG(wallet_stats.avg_ath_mcap) FILTER (WHERE wallet_stats.avg_ath_mcap IS NOT NULL) as avg_ath_mcap,
        AVG(wallet_stats.median_ath_mcap) FILTER (WHERE wallet_stats.median_ath_mcap IS NOT NULL) as avg_median_ath_mcap
      FROM (
        SELECT 
          ct.creator,
          COUNT(*)::DECIMAL as total_tokens,
          COUNT(*) FILTER (WHERE ct.bonded = true)::DECIMAL as bonded_tokens,
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
      ) as wallet_stats`
    );
    
    const basicStats = basicStatsResult.rows[0] || {};
    
    // Get all creator wallets to calculate complex metrics
    const creatorsResult = await pool.query(
      `SELECT DISTINCT ct.creator
       FROM tbl_soltrack_created_tokens ct
       ${whereClause}
       ORDER BY ct.creator`
    );
    
    const creatorAddresses = creatorsResult.rows.map(row => row.creator);
    
    if (creatorAddresses.length === 0) {
      res.json({
        avgTotalTokens: null,
        avgBondedTokens: null,
        avgWinRate: null,
        avgAthMcap: null,
        avgMedianAthMcap: null,
        avgRugRate: null,
        avgRugTime: null,
        avgBuyCount: null,
        avgBuyTotalSol: null,
        avgSellCount: null,
        avgSellTotalSol: null,
        avgRoi1stBuy: null,
        avgRoi2ndBuy: null,
        avgRoi3rdBuy: null
      });
      return;
    }
    
    // Get scoring settings for rug threshold
    let rugThresholdMcap = 6000; // Default value
    try {
      const settingsResult = await pool.query(
        `SELECT settings
         FROM tbl_soltrack_scoring_settings
         WHERE is_default = TRUE
         LIMIT 1`
      );
      if (settingsResult.rows.length > 0 && settingsResult.rows[0].settings) {
        rugThresholdMcap = settingsResult.rows[0].settings.rugThresholdMcap || 6000;
      }
    } catch (settingsError) {
      console.error('Error fetching scoring settings for avg-stats:', settingsError);
      // Use default value
    }
    
    // Get all tokens for all creators (limit to reasonable amount for performance)
    const tokensResult = await pool.query(
      `SELECT 
        ct.creator,
        ct.market_cap_time_series,
        ct.created_at,
        ct.ath_market_cap_usd,
        ct.initial_market_cap_usd
      FROM tbl_soltrack_created_tokens ct
      ${whereClause}
      ORDER BY ct.creator, ct.created_at DESC`
    );
    
    // Group tokens by creator
    const tokensByCreator = new Map<string, Array<{
      marketCapTimeSeries: any;
      createdAt: Date;
      athMarketCapUsd: number | null;
      initialMarketCapUsd: number | null;
      isFetched: boolean;
    }>>();
    
    for (const row of tokensResult.rows) {
      if (!tokensByCreator.has(row.creator)) {
        tokensByCreator.set(row.creator, []);
      }
      
      let marketCapTimeSeries = row.market_cap_time_series;
      if (typeof marketCapTimeSeries === 'string') {
        try {
          marketCapTimeSeries = JSON.parse(marketCapTimeSeries);
        } catch (e) {
          marketCapTimeSeries = [];
        }
      }
      if (!Array.isArray(marketCapTimeSeries)) {
        marketCapTimeSeries = [];
      }
      
      tokensByCreator.get(row.creator)!.push({
        marketCapTimeSeries,
        createdAt: new Date(row.created_at),
        athMarketCapUsd: row.ath_market_cap_usd ? parseFloat(row.ath_market_cap_usd) : null,
        initialMarketCapUsd: row.initial_market_cap_usd ? parseFloat(row.initial_market_cap_usd) : null,
        isFetched: true
      });
    }
    
    // Calculate averages across all creators
    let totalRugRate = 0;
    let totalRugTime = 0;
    let totalBuyCount = 0;
    let totalBuyTotalSol = 0;
    let totalSellCount = 0;
    let totalSellTotalSol = 0;
    let totalRoi1stBuy = 0;
    let totalRoi2ndBuy = 0;
    let totalRoi3rdBuy = 0;
    let creatorsWithRugRate = 0;
    let creatorsWithRugTime = 0;
    let creatorsWithBuySell = 0;
    let creatorsWithROI = 0;
    
    for (const creator of creatorAddresses) {
      try {
        const tokens = tokensByCreator.get(creator) || [];
        if (tokens.length === 0) continue;
        
        // Calculate rug rate (always returns a number)
        const rugRate = calculateRugRate(tokens, rugThresholdMcap);
        totalRugRate += rugRate;
        creatorsWithRugRate++;
        
        // Calculate rug time (can return null)
        const rugTime = calculateAvgRugTime(tokens, rugThresholdMcap);
        if (rugTime !== null) {
          totalRugTime += rugTime;
          creatorsWithRugTime++;
        }
        
        // Calculate buy/sell stats
        const buySellStats = calculateBuySellStats(tokens);
        if (buySellStats.avgBuyCount > 0 || buySellStats.avgSellCount > 0) {
          totalBuyCount += buySellStats.avgBuyCount;
          totalBuyTotalSol += buySellStats.avgBuyTotalSol;
          totalSellCount += buySellStats.avgSellCount;
          totalSellTotalSol += buySellStats.avgSellTotalSol;
          creatorsWithBuySell++;
        }
        
        // Calculate expected ROI
        const expectedROI = calculateExpectedROI(tokens);
        if (expectedROI.avgRoi1stBuy !== 0 || expectedROI.avgRoi2ndBuy !== 0 || expectedROI.avgRoi3rdBuy !== 0) {
          totalRoi1stBuy += expectedROI.avgRoi1stBuy;
          totalRoi2ndBuy += expectedROI.avgRoi2ndBuy;
          totalRoi3rdBuy += expectedROI.avgRoi3rdBuy;
          creatorsWithROI++;
        }
      } catch (err) {
        console.error(`Error calculating stats for creator ${creator}:`, err);
        // Continue with next creator
        continue;
      }
    }
    
    res.json({
      avgTotalTokens: basicStats.avg_total_tokens != null ? parseFloat(basicStats.avg_total_tokens) : null,
      avgBondedTokens: basicStats.avg_bonded_tokens != null ? parseFloat(basicStats.avg_bonded_tokens) : null,
      avgWinRate: basicStats.avg_win_rate != null ? parseFloat(basicStats.avg_win_rate) : null,
      avgAthMcap: basicStats.avg_ath_mcap != null ? parseFloat(basicStats.avg_ath_mcap) : null,
      avgMedianAthMcap: basicStats.avg_median_ath_mcap != null ? parseFloat(basicStats.avg_median_ath_mcap) : null,
      avgRugRate: creatorsWithRugRate > 0 ? Math.round((totalRugRate / creatorsWithRugRate) * 100) / 100 : null,
      avgRugTime: creatorsWithRugTime > 0 ? Math.round((totalRugTime / creatorsWithRugTime) * 100) / 100 : null,
      avgBuyCount: creatorsWithBuySell > 0 ? Math.round((totalBuyCount / creatorsWithBuySell) * 100) / 100 : null,
      avgBuyTotalSol: creatorsWithBuySell > 0 ? Math.round((totalBuyTotalSol / creatorsWithBuySell) * 100) / 100 : null,
      avgSellCount: creatorsWithBuySell > 0 ? Math.round((totalSellCount / creatorsWithBuySell) * 100) / 100 : null,
      avgSellTotalSol: creatorsWithBuySell > 0 ? Math.round((totalSellTotalSol / creatorsWithBuySell) * 100) / 100 : null,
      avgRoi1stBuy: creatorsWithROI > 0 ? Math.round((totalRoi1stBuy / creatorsWithROI) * 100) / 100 : null,
      avgRoi2ndBuy: creatorsWithROI > 0 ? Math.round((totalRoi2ndBuy / creatorsWithROI) * 100) / 100 : null,
      avgRoi3rdBuy: creatorsWithROI > 0 ? Math.round((totalRoi3rdBuy / creatorsWithROI) * 100) / 100 : null
    });
  } catch (error: any) {
    console.error('Error fetching average statistics:', error);
    res.status(500).json({ 
      error: 'Error fetching average statistics' 
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

// Calculate average rug time for tokens
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
  // Consider all tokens that have market cap time series data
  // (both streamed and fetched tokens can have time series data)
  if (tokens.length === 0) return null;
  
  const rugTimes: number[] = [];
  
  for (const token of tokens) {
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

// Calculate What If PNL for a creator wallet based on simulation settings
function calculateWhatIfPNL(
  tokens: Array<{
    createdAt: Date;
    marketCapTimeSeries: any;
  }>,
  settings: {
    buyPosition: number; // Buy at position X after dev (e.g., 2 = 2nd buy after dev)
    sellStrategy: 'time' | 'pnl' | 'multiple';
    sellAtSeconds?: number; // Sell at X seconds
    sellAtPnlPercent?: number; // Sell if PNL >= X%
    multipleSells?: Array<{ type: 'time' | 'pnl'; value: number; sizePercent: number }>; // Multiple sells: [{type: 'time', value: 3, sizePercent: 50}, {type: 'pnl', value: 100, sizePercent: 50}]
  }
): {
  avgPnl: number;
  avgPnlPercent: number;
  tokensSimulated: number;
} {
  if (tokens.length === 0) {
    return {
      avgPnl: 0,
      avgPnlPercent: 0,
      tokensSimulated: 0
    };
  }
  
  let totalPnl = 0;
  let totalPnlPercent = 0;
  let tokensSimulated = 0;
  
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
    
    // Get token creation time
    const createdAtMs = new Date(token.createdAt).getTime();
    
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
        timestamp: point.timestamp || point.time || 0,
        solPriceUsd: point.solPriceUsd || point.sol_price_usd || 0
      }))
      .sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp to get order
    
    // Need at least buyPosition buys (position 1 = first buy after dev, position 2 = second buy, etc.)
    if (buyTrades.length < settings.buyPosition) {
      continue; // Not enough buys
    }
    
    // Get buy price at the specified position (position is 1-indexed, so position 2 = index 1)
    const buyTrade = buyTrades[settings.buyPosition - 1];
    if (!buyTrade || buyTrade.executionPriceSol <= 0) {
      continue;
    }
    
    const buyPriceSol = buyTrade.executionPriceSol;
    const buyTimestamp = buyTrade.timestamp;
    const buySolPriceUsd = buyTrade.solPriceUsd || 0;
    
    // Calculate buy cost (assume 1 SOL investment for simplicity, or we could use actual trade amounts)
    const buyAmountSol = 1; // Standardized to 1 SOL for comparison
    const buyAmountUsd = buyAmountSol * (buySolPriceUsd || 0);
    const tokensBought = buyAmountSol / buyPriceSol;
    
    // Simulate selling based on strategy
    let totalSellAmountUsd = 0;
    let remainingTokens = tokensBought;
    let totalSellAmountSol = 0;
    
    if (settings.sellStrategy === 'time' && settings.sellAtSeconds !== undefined) {
      // Sell at X seconds after creation
      const sellTimestamp = createdAtMs + (settings.sellAtSeconds * 1000);
      
      // Find the closest price point at or after sell timestamp
      let sellPriceSol: number | null = null;
      let sellSolPriceUsd = 0;
      
      // Sort all trades by timestamp
      const allTrades = marketCapTimeSeries
        .map((point: any) => ({
          timestamp: point.timestamp || point.time || 0,
          executionPriceSol: point.executionPriceSol || point.execution_price_sol || 0,
          solPriceUsd: point.solPriceUsd || point.sol_price_usd || 0,
          marketCapUsd: point.marketCapUsd || point.market_cap_usd || 0
        }))
        .filter((p: any) => p.timestamp >= buyTimestamp && p.executionPriceSol > 0)
        .sort((a: any, b: any) => a.timestamp - b.timestamp);
      
      // Find price at sell timestamp
      for (const trade of allTrades) {
        if (trade.timestamp >= sellTimestamp) {
          sellPriceSol = trade.executionPriceSol;
          sellSolPriceUsd = trade.solPriceUsd || 0;
          break;
        }
      }
      
      // If no exact match, use the last available price
      if (sellPriceSol === null && allTrades.length > 0) {
        const lastTrade = allTrades[allTrades.length - 1];
        sellPriceSol = lastTrade.executionPriceSol;
        sellSolPriceUsd = lastTrade.solPriceUsd || 0;
      }
      
      if (sellPriceSol && sellPriceSol > 0) {
        totalSellAmountSol = remainingTokens * sellPriceSol;
        totalSellAmountUsd = totalSellAmountSol * (sellSolPriceUsd || 0);
      }
      
    } else if (settings.sellStrategy === 'pnl' && settings.sellAtPnlPercent !== undefined) {
      // Sell when PNL >= X%
      const targetPnlPercent = settings.sellAtPnlPercent;
      
      // Sort all trades by timestamp after buy
      const allTrades = marketCapTimeSeries
        .map((point: any) => ({
          timestamp: point.timestamp || point.time || 0,
          executionPriceSol: point.executionPriceSol || point.execution_price_sol || 0,
          solPriceUsd: point.solPriceUsd || point.sol_price_usd || 0,
          marketCapUsd: point.marketCapUsd || point.market_cap_usd || 0
        }))
        .filter((p: any) => p.timestamp >= buyTimestamp && p.executionPriceSol > 0)
        .sort((a: any, b: any) => a.timestamp - b.timestamp);
      
      // Find first price where PNL >= target
      for (const trade of allTrades) {
        const currentPriceSol = trade.executionPriceSol;
        const pnlPercent = ((currentPriceSol - buyPriceSol) / buyPriceSol) * 100;
        
        if (pnlPercent >= targetPnlPercent) {
          totalSellAmountSol = remainingTokens * currentPriceSol;
          totalSellAmountUsd = totalSellAmountSol * (trade.solPriceUsd || 0);
          break;
        }
      }
      
    } else if (settings.sellStrategy === 'multiple' && settings.multipleSells && settings.multipleSells.length > 0) {
      // Multiple sells at different times or PNL levels with different sizes
      const allTrades = marketCapTimeSeries
        .map((point: any) => ({
          timestamp: point.timestamp || point.time || 0,
          executionPriceSol: point.executionPriceSol || point.execution_price_sol || 0,
          solPriceUsd: point.solPriceUsd || point.sol_price_usd || 0,
          marketCapUsd: point.marketCapUsd || point.market_cap_usd || 0
        }))
        .filter((p: any) => p.timestamp >= buyTimestamp && p.executionPriceSol > 0)
        .sort((a: any, b: any) => a.timestamp - b.timestamp);
      
      // Process each sell - can be time-based or PNL-based
      for (const sell of settings.multipleSells) {
        if (remainingTokens <= 0) break;
        
        const sellSize = (sell.sizePercent / 100) * tokensBought;
        const actualSellSize = Math.min(sellSize, remainingTokens);
        
        let sellPriceSol: number | null = null;
        let sellSolPriceUsd = 0;
        
        if (sell.type === 'time') {
          // Time-based sell: sell at X seconds
          const sellTimestamp = createdAtMs + (sell.value * 1000);
          
          // Find price at sell timestamp
          for (const trade of allTrades) {
            if (trade.timestamp >= sellTimestamp) {
              sellPriceSol = trade.executionPriceSol;
              sellSolPriceUsd = trade.solPriceUsd || 0;
              break;
            }
          }
          
          // If no exact match, use the last available price
          if (sellPriceSol === null && allTrades.length > 0) {
            const lastTrade = allTrades[allTrades.length - 1];
            sellPriceSol = lastTrade.executionPriceSol;
            sellSolPriceUsd = lastTrade.solPriceUsd || 0;
          }
        } else if (sell.type === 'pnl') {
          // PNL-based sell: sell when PNL >= X%
          const targetPnlPercent = sell.value;
          
          // Find first price where PNL >= target
          for (const trade of allTrades) {
            const currentPriceSol = trade.executionPriceSol;
            const pnlPercent = ((currentPriceSol - buyPriceSol) / buyPriceSol) * 100;
            
            if (pnlPercent >= targetPnlPercent) {
              sellPriceSol = currentPriceSol;
              sellSolPriceUsd = trade.solPriceUsd || 0;
              break;
            }
          }
        }
        
        if (sellPriceSol && sellPriceSol > 0) {
          const sellAmountSol = actualSellSize * sellPriceSol;
          totalSellAmountSol += sellAmountSol;
          totalSellAmountUsd += sellAmountSol * (sellSolPriceUsd || 0);
          remainingTokens -= actualSellSize;
        }
      }
    }
    
    // Calculate PNL
    if (totalSellAmountUsd > 0 && buyAmountUsd > 0) {
      const pnlUsd = totalSellAmountUsd - buyAmountUsd;
      const pnlPercent = ((totalSellAmountSol - buyAmountSol) / buyAmountSol) * 100;
      
      totalPnl += pnlUsd;
      totalPnlPercent += pnlPercent;
      tokensSimulated++;
    }
  }
  
  // Calculate averages
  const avgPnl = tokensSimulated > 0 ? totalPnl / tokensSimulated : 0;
  const avgPnlPercent = tokensSimulated > 0 ? totalPnlPercent / tokensSimulated : 0;
  
  return {
    avgPnl: Math.round(avgPnl * 100) / 100,
    avgPnlPercent: Math.round(avgPnlPercent * 100) / 100,
    tokensSimulated
  };
}

// Helper function to extract minimum buy amount filters from avgBuySells filters
function extractMinBuyAmountFilters(filters: any): { minBuyAmountSol?: number | null; minBuyAmountToken?: number | null } {
  if (!filters || !filters.avgBuySells || !Array.isArray(filters.avgBuySells)) {
    return { minBuyAmountSol: null, minBuyAmountToken: null };
  }
  
  // Find the buyCount filter
  const buyCountFilter = filters.avgBuySells.find((f: any) => f.type === 'buyCount');
  if (!buyCountFilter) {
    return { minBuyAmountSol: null, minBuyAmountToken: null };
  }
  
  return {
    minBuyAmountSol: buyCountFilter.minBuyAmountSol !== undefined ? buyCountFilter.minBuyAmountSol : null,
    minBuyAmountToken: buyCountFilter.minBuyAmountToken !== undefined ? buyCountFilter.minBuyAmountToken : null
  };
}

// Calculate average buy/sell statistics for a creator wallet
function calculateBuySellStats(
  tokens: Array<{
    marketCapTimeSeries: any;
  }>,
  minBuyAmountSol?: number | null,
  minBuyAmountToken?: number | null
): {
  avgBuyCount: number;
  avgBuyTotalSol: number;
  avgSellCount: number;
  avgSellTotalSol: number;
  avgFirst5BuySol: number;
  medianFirst5BuySol: number;
} {
  if (tokens.length === 0) {
    return {
      avgBuyCount: 0,
      avgBuyTotalSol: 0,
      avgSellCount: 0,
      avgSellTotalSol: 0,
      avgFirst5BuySol: 0,
      medianFirst5BuySol: 0
    };
  }
  
  let totalBuyCount = 0;
  let totalBuySol = 0;
  let totalSellCount = 0;
  let totalSellSol = 0;
  let tokensWithData = 0;
  
  // Collect first 5 buy SOL amounts from each token
  const allFirst5BuySols: number[] = [];
  
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
    
    // Collect first 5 buy SOL amounts for this token
    const first5BuySols: number[] = [];
    
    for (const point of marketCapTimeSeries) {
      const tradeType = point.tradeType || point.trade_type;
      // Use solAmount (actual SOL amount for the trade) - this is required for accurate calculations
      // Old data might not have solAmount, so we skip those trades
      const solAmount = point.solAmount !== undefined ? point.solAmount : 
                       (point.sol_amount !== undefined ? point.sol_amount : null);
      
      // Get tokenAmount for minimum token amount filtering
      const tokenAmount = point.tokenAmount !== undefined ? point.tokenAmount : 
                         (point.token_amount !== undefined ? point.token_amount : null);
      
      // Skip trades without solAmount (old data format)
      if (solAmount === null || solAmount === undefined) {
        continue;
      }
      
      if (tradeType === 'buy') {
        // Apply minimum buy amount filters if set
        if (minBuyAmountSol !== null && minBuyAmountSol !== undefined && solAmount < minBuyAmountSol) {
          continue; // Skip this buy if it's below minimum SOL amount
        }
        if (minBuyAmountToken !== null && minBuyAmountToken !== undefined && 
            tokenAmount !== null && tokenAmount !== undefined && tokenAmount < minBuyAmountToken) {
          continue; // Skip this buy if it's below minimum token amount
        }
        
        buyCount++;
        buySol += solAmount;
        
        // Collect first 5 buy SOL amounts
        if (first5BuySols.length < 5) {
          first5BuySols.push(solAmount);
        }
      } else if (tradeType === 'sell') {
        sellCount++;
        sellSol += solAmount;
      }
    }
    
    // Add first 5 buy SOL amounts to the overall collection
    allFirst5BuySols.push(...first5BuySols);
    
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
  
  // Calculate average and median of first 5 buy SOL amounts
  let avgFirst5BuySol = 0;
  let medianFirst5BuySol = 0;
  
  if (allFirst5BuySols.length > 0) {
    // Calculate average
    const sum = allFirst5BuySols.reduce((acc, val) => acc + val, 0);
    avgFirst5BuySol = sum / allFirst5BuySols.length;
    
    // Calculate median
    const sorted = [...allFirst5BuySols].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      medianFirst5BuySol = (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      medianFirst5BuySol = sorted[mid];
    }
  }
  
  return {
    avgBuyCount: Math.round(avgBuyCount * 100) / 100,
    avgBuyTotalSol: Math.round(avgBuyTotalSol * 100) / 100,
    avgSellCount: Math.round(avgSellCount * 100) / 100,
    avgSellTotalSol: Math.round(avgSellTotalSol * 100) / 100,
    avgFirst5BuySol: Math.round(avgFirst5BuySol * 100) / 100,
    medianFirst5BuySol: Math.round(medianFirst5BuySol * 100) / 100
  };
}

// Get creator wallets analytics with pagination
router.post('/creators/analytics', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const viewAll = req.query.viewAll === 'true' || req.query.viewAll === '1';
    const filters = req.body?.filters || {};
    const whatIfSettings = req.body?.whatIfSettings || null;
    
    // Parse sorting parameters
    const sortColumn = req.query.sortColumn as string || null;
    const sortDirection = req.query.sortDirection as string || 'desc';
    
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
    
    // Build base WHERE clause
    let baseWhereClause = '';
    if (!viewAll) {
      baseWhereClause = 'WHERE ct.creator NOT IN (SELECT wallet_address FROM tbl_soltrack_blacklist_creator)';
    }
    
    // Get rug threshold from settings (default 6000) - need this early for calculations
    const rugThresholdMcap = scoringSettings?.rugThresholdMcap || 6000;
    
    // Build SQL-level filters for simple metrics that can be filtered in SQL
    // These filters will reduce the dataset before fetching tokens
    const sqlFilterConditions: string[] = [];
    const sqlFilterParams: any[] = [];
    let paramIndex = 1;
    
    // Filter by total tokens (can be done in SQL HAVING clause)
    if (filters.totalTokens) {
      if (filters.totalTokens.min !== undefined && filters.totalTokens.min !== null) {
        sqlFilterConditions.push(`COUNT(*) >= $${paramIndex}`);
        sqlFilterParams.push(filters.totalTokens.min);
        paramIndex++;
      }
      if (filters.totalTokens.max !== undefined && filters.totalTokens.max !== null) {
        sqlFilterConditions.push(`COUNT(*) <= $${paramIndex}`);
        sqlFilterParams.push(filters.totalTokens.max);
        paramIndex++;
      }
    }
    
    // Filter by bonded tokens (can be done in SQL HAVING clause)
    if (filters.bondedTokens) {
      if (filters.bondedTokens.min !== undefined && filters.bondedTokens.min !== null) {
        sqlFilterConditions.push(`COUNT(*) FILTER (WHERE ct.bonded = true) >= $${paramIndex}`);
        sqlFilterParams.push(filters.bondedTokens.min);
        paramIndex++;
      }
      if (filters.bondedTokens.max !== undefined && filters.bondedTokens.max !== null) {
        sqlFilterConditions.push(`COUNT(*) FILTER (WHERE ct.bonded = true) <= $${paramIndex}`);
        sqlFilterParams.push(filters.bondedTokens.max);
        paramIndex++;
      }
    }
    
    // Filter by win rate (can be done in SQL HAVING clause)
    if (filters.winRate && Array.isArray(filters.winRate) && filters.winRate.length > 0) {
      for (const filter of filters.winRate) {
        if (filter.type === 'percent') {
          if (filter.min !== undefined && filter.min !== null) {
            sqlFilterConditions.push(`(COUNT(*) FILTER (WHERE ct.bonded = true)::DECIMAL / NULLIF(COUNT(*)::DECIMAL, 0) * 100) >= $${paramIndex}`);
            sqlFilterParams.push(filter.min);
            paramIndex++;
          }
          if (filter.max !== undefined && filter.max !== null) {
            sqlFilterConditions.push(`(COUNT(*) FILTER (WHERE ct.bonded = true)::DECIMAL / NULLIF(COUNT(*)::DECIMAL, 0) * 100) <= $${paramIndex}`);
            sqlFilterParams.push(filter.max);
            paramIndex++;
          }
        }
        // Score-based win rate filters need to be done after score calculation
      }
    }
    
    // Filter by average ATH mcap (can be done in SQL HAVING clause)
    if (filters.avgMcap && Array.isArray(filters.avgMcap) && filters.avgMcap.length > 0) {
      for (const filter of filters.avgMcap) {
        if (filter.type === 'mcap') {
          if (filter.min !== undefined && filter.min !== null) {
            sqlFilterConditions.push(`AVG(ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL) >= $${paramIndex}`);
            sqlFilterParams.push(filter.min);
            paramIndex++;
          }
          if (filter.max !== undefined && filter.max !== null) {
            sqlFilterConditions.push(`AVG(ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL) <= $${paramIndex}`);
            sqlFilterParams.push(filter.max);
            paramIndex++;
          }
        }
        // Percentile and score-based filters need to be done after calculation
      }
    }
    
    // Filter by median ATH mcap (can be done in SQL HAVING clause)
    if (filters.medianMcap && Array.isArray(filters.medianMcap) && filters.medianMcap.length > 0) {
      for (const filter of filters.medianMcap) {
        if (filter.type === 'mcap') {
          if (filter.min !== undefined && filter.min !== null) {
            sqlFilterConditions.push(`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL AND ct.ath_market_cap_usd > 0) >= $${paramIndex}`);
            sqlFilterParams.push(filter.min);
            paramIndex++;
          }
          if (filter.max !== undefined && filter.max !== null) {
            sqlFilterConditions.push(`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL AND ct.ath_market_cap_usd > 0) <= $${paramIndex}`);
            sqlFilterParams.push(filter.max);
            paramIndex++;
          }
        }
        // Score-based filters need to be done after calculation
      }
    }
    
    // Build HAVING clause for SQL filters
    const havingClause = sqlFilterConditions.length > 0 
      ? `HAVING ${sqlFilterConditions.join(' AND ')}`
      : '';
    
    // Always get ALL wallets data to calculate percentile ranks for display
    // This is needed to show where each creator ranks among all creators (0-100 percentile)
    // Note: This query is fast because it only aggregates basic stats, no token details
    const allWalletsResult = await pool.query(
      `SELECT 
        ct.creator,
        AVG(ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL) as avg_ath_mcap,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL AND ct.ath_market_cap_usd > 0) as median_ath_mcap
      FROM tbl_soltrack_created_tokens ct
      ${baseWhereClause}
      GROUP BY ct.creator`
    );
    
    const allWalletsData = allWalletsResult.rows.map(row => ({
      avgAthMcap: row.avg_ath_mcap ? parseFloat(row.avg_ath_mcap) : null,
      medianAthMcap: row.median_ath_mcap ? parseFloat(row.median_ath_mcap) : null
    }));
    
    // Determine if we can use SQL sorting for simple fields
    const sqlSortableFields: Record<string, string> = {
      'totalTokens': 'COUNT(*)',
      'bondedTokens': 'COUNT(*) FILTER (WHERE ct.bonded = true)',
      'winRate': '(COUNT(*) FILTER (WHERE ct.bonded = true)::DECIMAL / NULLIF(COUNT(*)::DECIMAL, 0) * 100)',
      'avgAthMcap': 'AVG(ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL)',
      'medianAthMcap': 'PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL AND ct.ath_market_cap_usd > 0)'
    };
    
    // Build ORDER BY clause for SQL if sorting by a simple field
    let orderByClause = 'ORDER BY win_rate DESC, total_tokens DESC'; // Default
    if (sortColumn && sqlSortableFields[sortColumn]) {
      const direction = sortDirection.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      orderByClause = `ORDER BY ${sqlSortableFields[sortColumn]} ${direction}`;
    }
    
    // Get filtered creator wallets with basic statistics (SQL-level filtering applied)
    // This significantly reduces the dataset before fetching tokens
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
      ${baseWhereClause}
      GROUP BY ct.creator
      ${havingClause}
      ${orderByClause}`,
      sqlFilterParams
    );
    
    // Check if complex filters are active (these require token data)
    // Complex filters: rugRate, avgRugTime, avgBuySells, expectedROI, finalScore
    const hasComplexFilters = !!(
      filters.rugRate || 
      filters.avgRugTime || 
      (filters.avgBuySells && Array.isArray(filters.avgBuySells) && filters.avgBuySells.length > 0) ||
      (filters.expectedROI && Array.isArray(filters.expectedROI) && filters.expectedROI.length > 0) ||
      filters.finalScore ||
      (filters.winRate && Array.isArray(filters.winRate) && filters.winRate.some((f: any) => f.type === 'score')) ||
      (filters.avgMcap && Array.isArray(filters.avgMcap) && filters.avgMcap.some((f: any) => f.type === 'score')) ||
      (filters.medianMcap && Array.isArray(filters.medianMcap) && filters.medianMcap.some((f: any) => f.type === 'score'))
    );
    
    // Check if sorting by complex fields (these require token data)
    const complexSortFields = ['avgRugRate', 'avgRugTime', 'avgBuyCount', 'avgBuyTotalSol', 'avgSellCount', 'avgSellTotalSol', 'avgRoi1stBuy', 'avgRoi2ndBuy', 'avgRoi3rdBuy', 'finalScore'];
    const sortingByComplexField = sortColumn && complexSortFields.includes(sortColumn);
    
    // Determine which wallets need token data
    // If complex filters or complex sorting is active, we need tokens for ALL filtered wallets
    // Otherwise, we only need tokens for paginated wallets (for display)
    const needsTokensForAll = hasComplexFilters || sortingByComplexField;
    
    let tokensByCreator: Map<string, Array<{ initialMarketCapUsd: number | null; athMarketCapUsd: number | null }>> = new Map();
    let allTokensByCreator: Map<string, Array<{ 
      athMarketCapUsd: number | null;
      isFetched: boolean;
      createdAt: Date;
      marketCapTimeSeries: any;
    }>> = new Map();
    
    // Determine which creator addresses need token data
    const creatorAddressesForTokens = needsTokensForAll 
      ? result.rows.map(row => row.address)  // All filtered wallets
      : [];  // Will be set after pagination
    
    // Fetch tokens if needed
    if (creatorAddressesForTokens.length > 0) {
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
        [creatorAddressesForTokens]
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
        [creatorAddressesForTokens]
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
      
      // Get tokens for this creator and calculate stats
      // If tokens weren't fetched (needsTokensForAll = false), use empty arrays
      // We'll recalculate these stats after pagination for the wallets that are displayed
      const tokens = tokensByCreator.get(row.address) || [];
      const allTokens = allTokensByCreator.get(row.address) || [];
      
      // Only calculate token-dependent stats if we have token data
      // Otherwise, use default values (will be recalculated after pagination if needed)
      const hasTokenData = needsTokensForAll && (tokens.length > 0 || allTokens.length > 0);
      
      const multiplierPercentages = hasTokenData ? calculateMultiplierPercentages(tokens) : new Map<number, number>();
      
      // Count valid tokens (tokens with both initial and ATH market cap > 0)
      const validTokenCount = hasTokenData ? tokens.filter(
        t => t.initialMarketCapUsd !== null && 
             t.initialMarketCapUsd > 0 && 
             t.athMarketCapUsd !== null && 
             t.athMarketCapUsd > 0
      ).length : 0;
      
      // Calculate overall rug rate
      const avgRugRate = hasTokenData ? calculateRugRate(allTokens, rugThresholdMcap) : 0;
      
      // Calculate average rug time (only for streamed tokens)
      const avgRugTime = hasTokenData ? calculateAvgRugTime(allTokens, rugThresholdMcap) : null;
      
      // Extract minimum buy amount filters
      const { minBuyAmountSol, minBuyAmountToken } = extractMinBuyAmountFilters(filters);
      
      // Calculate buy/sell statistics
      const buySellStats = hasTokenData ? calculateBuySellStats(allTokens, minBuyAmountSol, minBuyAmountToken) : {
        avgBuyCount: 0,
        avgBuyTotalSol: 0,
        avgSellCount: 0,
        avgSellTotalSol: 0,
        avgFirst5BuySol: 0,
        medianFirst5BuySol: 0
      };
      
      // Calculate expected ROI for 1st/2nd/3rd buy positions
      const expectedROI = hasTokenData ? calculateExpectedROI(allTokens) : {
        avgRoi1stBuy: 0,
        avgRoi2ndBuy: 0,
        avgRoi3rdBuy: 0
      };
      
      // Calculate What If PNL if settings are provided
      let whatIfPnl = null;
      if (hasTokenData && whatIfSettings && whatIfSettings.buyPosition && whatIfSettings.sellStrategy) {
        whatIfPnl = calculateWhatIfPNL(allTokens, whatIfSettings);
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
      
      if (scoringSettings && hasTokenData) {
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
        whatIfPnl: whatIfPnl,
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
          if (filters.totalTokens.min != null && wallet.totalTokens < filters.totalTokens.min) {
            return false;
          }
          if (filters.totalTokens.max != null && wallet.totalTokens > filters.totalTokens.max) {
            return false;
          }
        }
        
        // Filter by bonded tokens
        if (filters.bondedTokens) {
          if (filters.bondedTokens.min != null && wallet.bondedTokens < filters.bondedTokens.min) {
            return false;
          }
          if (filters.bondedTokens.max != null && wallet.bondedTokens > filters.bondedTokens.max) {
            return false;
          }
        }
        
        // Filter by win rate (all filters must match - AND logic)
        if (filters.winRate && Array.isArray(filters.winRate) && filters.winRate.length > 0) {
          for (const filter of filters.winRate) {
            if (filter.type === 'percent') {
              const matches = (
                (filter.min == null || wallet.winRate >= filter.min) &&
                (filter.max == null || wallet.winRate <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === 'score') {
              const matches = (
                (filter.min == null || wallet.scores.winRateScore >= filter.min) &&
                (filter.max == null || wallet.scores.winRateScore <= filter.max)
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
                (filter.min == null || wallet.avgAthMcap >= filter.min) &&
                (filter.max == null || wallet.avgAthMcap <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === 'percentile') {
              if (wallet.athMcapPercentileRank === null) return false;
              const matches = (
                (filter.min == null || wallet.athMcapPercentileRank >= filter.min) &&
                (filter.max == null || wallet.athMcapPercentileRank <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === 'score') {
              const matches = (
                (filter.min == null || wallet.scores.avgAthMcapScore >= filter.min) &&
                (filter.max == null || wallet.scores.avgAthMcapScore <= filter.max)
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
                (filter.min == null || wallet.medianAthMcap >= filter.min) &&
                (filter.max == null || wallet.medianAthMcap <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === 'score') {
              const matches = (
                (filter.min == null || wallet.scores.medianAthMcapScore >= filter.min) &&
                (filter.max == null || wallet.scores.medianAthMcapScore <= filter.max)
              );
              if (!matches) return false;
            }
          }
        }
        
        // Filter by avg buy/sells (all filters must match - AND logic)
        if (filters.avgBuySells && Array.isArray(filters.avgBuySells) && filters.avgBuySells.length > 0) {
          for (const filter of filters.avgBuySells) {
            if (filter.type === 'buyCount') {
              const matches = (
                (filter.min == null || wallet.buySellStats.avgBuyCount >= filter.min) &&
                (filter.max == null || wallet.buySellStats.avgBuyCount <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === 'buySol') {
              const matches = (
                (filter.min == null || wallet.buySellStats.avgBuyTotalSol >= filter.min) &&
                (filter.max == null || wallet.buySellStats.avgBuyTotalSol <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === 'sellCount') {
              const matches = (
                (filter.min == null || wallet.buySellStats.avgSellCount >= filter.min) &&
                (filter.max == null || wallet.buySellStats.avgSellCount <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === 'sellSol') {
              const matches = (
                (filter.min == null || wallet.buySellStats.avgSellTotalSol >= filter.min) &&
                (filter.max == null || wallet.buySellStats.avgSellTotalSol <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === 'avgFirst5BuySol') {
              const avgFirst5BuySol = (wallet.buySellStats as any).avgFirst5BuySol ?? 0;
              const matches = (
                (filter.min == null || avgFirst5BuySol >= filter.min) &&
                (filter.max == null || avgFirst5BuySol <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === 'medianFirst5BuySol') {
              const medianFirst5BuySol = (wallet.buySellStats as any).medianFirst5BuySol ?? 0;
              const matches = (
                (filter.min == null || medianFirst5BuySol >= filter.min) &&
                (filter.max == null || medianFirst5BuySol <= filter.max)
              );
              if (!matches) return false;
            }
          }
        }
        
        // Filter by expected ROI (all filters must match - AND logic)
        if (filters.expectedROI && Array.isArray(filters.expectedROI) && filters.expectedROI.length > 0) {
          for (const filter of filters.expectedROI) {
            if (filter.type === '1st') {
              const matches = (
                (filter.min == null || wallet.expectedROI.avgRoi1stBuy >= filter.min) &&
                (filter.max == null || wallet.expectedROI.avgRoi1stBuy <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === '2nd') {
              const matches = (
                (filter.min == null || wallet.expectedROI.avgRoi2ndBuy >= filter.min) &&
                (filter.max == null || wallet.expectedROI.avgRoi2ndBuy <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === '3rd') {
              const matches = (
                (filter.min == null || wallet.expectedROI.avgRoi3rdBuy >= filter.min) &&
                (filter.max == null || wallet.expectedROI.avgRoi3rdBuy <= filter.max)
              );
              if (!matches) return false;
            }
          }
        }
        
        // Filter by rug rate
        if (filters.rugRate) {
          if (filters.rugRate.min != null && wallet.avgRugRate < filters.rugRate.min) {
            return false;
          }
          if (filters.rugRate.max != null && wallet.avgRugRate > filters.rugRate.max) {
            return false;
          }
        }
        
        // Filter by avg rug time
        if (filters.avgRugTime) {
          if (wallet.avgRugTime === null) return false;
          if (filters.avgRugTime.min != null && wallet.avgRugTime < filters.avgRugTime.min) {
            return false;
          }
          if (filters.avgRugTime.max != null && wallet.avgRugTime > filters.avgRugTime.max) {
            return false;
          }
        }
        
        // Filter by final score
        if (filters.finalScore) {
          if (filters.finalScore.min != null && wallet.scores.finalScore < filters.finalScore.min) {
            return false;
          }
          if (filters.finalScore.max != null && wallet.scores.finalScore > filters.finalScore.max) {
            return false;
          }
        }
        
        // Filter by multiplier scores (all filters must match - AND logic)
        if (filters.multiplierScores && Array.isArray(filters.multiplierScores) && filters.multiplierScores.length > 0) {
          for (const filter of filters.multiplierScores) {
            if (filter.type === 'percent') {
              const percentage = wallet.multiplierPercentages[filter.multiplier];
              if (percentage === undefined || percentage === null) return false;
              const matches = (
                (filter.min == null || percentage >= filter.min) &&
                (filter.max == null || percentage <= filter.max)
              );
              if (!matches) return false;
            } else if (filter.type === 'score') {
              const score = wallet.scores.individualMultiplierScores[filter.multiplier];
              if (score === undefined || score === null) return false;
              const matches = (
                (filter.min == null || score >= filter.min) &&
                (filter.max == null || score <= filter.max)
              );
              if (!matches) return false;
            }
          }
        }
        
        return true;
      });
    }
    
    // Apply sorting
    // If sorting by a SQL-sortable field, it's already sorted by SQL, so we can skip in-memory sorting
    let sortedWallets = [...filteredWallets];
    
    // Only do in-memory sorting if sorting by a complex field (not SQL-sortable)
    if (sortColumn && !sqlSortableFields[sortColumn]) {
      const direction = sortDirection.toLowerCase() === 'asc' ? 1 : -1;
      
      sortedWallets.sort((a, b) => {
        let aVal: any;
        let bVal: any;
        
        switch (sortColumn) {
          case 'address':
            aVal = a.address.toLowerCase();
            bVal = b.address.toLowerCase();
            return aVal.localeCompare(bVal) * direction;
          
          case 'avgRugRate':
            aVal = a.avgRugRate ?? 0;
            bVal = b.avgRugRate ?? 0;
            return (aVal - bVal) * direction;
          
          case 'avgRugTime':
            aVal = a.avgRugTime ?? 0;
            bVal = b.avgRugTime ?? 0;
            return (aVal - bVal) * direction;
          
          case 'finalScore':
            aVal = a.scores.finalScore ?? 0;
            bVal = b.scores.finalScore ?? 0;
            return (aVal - bVal) * direction;
          
          case 'avgBuyCount':
            aVal = a.buySellStats.avgBuyCount ?? 0;
            bVal = b.buySellStats.avgBuyCount ?? 0;
            return (aVal - bVal) * direction;
          
          case 'avgBuySol':
            aVal = a.buySellStats.avgBuyTotalSol ?? 0;
            bVal = b.buySellStats.avgBuyTotalSol ?? 0;
            return (aVal - bVal) * direction;
          
          case 'avgSellCount':
            aVal = a.buySellStats.avgSellCount ?? 0;
            bVal = b.buySellStats.avgSellCount ?? 0;
            return (aVal - bVal) * direction;
          
          case 'avgSellSol':
            aVal = a.buySellStats.avgSellTotalSol ?? 0;
            bVal = b.buySellStats.avgSellTotalSol ?? 0;
            return (aVal - bVal) * direction;
          
          case 'avgFirst5BuySol':
            aVal = (a.buySellStats as any).avgFirst5BuySol ?? 0;
            bVal = (b.buySellStats as any).avgFirst5BuySol ?? 0;
            return (aVal - bVal) * direction;
          
          case 'medianFirst5BuySol':
            aVal = (a.buySellStats as any).medianFirst5BuySol ?? 0;
            bVal = (b.buySellStats as any).medianFirst5BuySol ?? 0;
            return (aVal - bVal) * direction;
          
          case 'roi1st':
            aVal = a.expectedROI.avgRoi1stBuy ?? 0;
            bVal = b.expectedROI.avgRoi1stBuy ?? 0;
            return (aVal - bVal) * direction;
          
          case 'roi2nd':
            aVal = a.expectedROI.avgRoi2ndBuy ?? 0;
            bVal = b.expectedROI.avgRoi2ndBuy ?? 0;
            return (aVal - bVal) * direction;
          
          case 'roi3rd':
            aVal = a.expectedROI.avgRoi3rdBuy ?? 0;
            bVal = b.expectedROI.avgRoi3rdBuy ?? 0;
            return (aVal - bVal) * direction;
          
          case 'whatIfPnl':
            if (!a.whatIfPnl || !b.whatIfPnl) {
              if (!a.whatIfPnl && !b.whatIfPnl) return 0;
              return (!a.whatIfPnl ? -1 : 1) * direction;
            }
            aVal = a.whatIfPnl.avgPnl ?? 0;
            bVal = b.whatIfPnl.avgPnl ?? 0;
            return (aVal - bVal) * direction;
          
          default:
            // Default to final score if scoring settings are available
            if (scoringSettings) {
              aVal = a.scores.finalScore ?? 0;
              bVal = b.scores.finalScore ?? 0;
              return (bVal - aVal); // Default descending
            }
            return 0;
        }
      });
    } else if (!sortColumn) {
      // Default sorting: by final score if scoring settings are available, otherwise keep SQL order
      if (scoringSettings) {
        sortedWallets.sort((a, b) => b.scores.finalScore - a.scores.finalScore);
      }
    }
    // If sortColumn is a SQL-sortable field, wallets are already sorted by SQL, no need to sort again
    
    const wallets = sortedWallets;
    
    // Recalculate total count after filtering
    const filteredTotal = wallets.length;
    
    // If we didn't fetch tokens for all wallets (no complex filters), fetch them now for paginated wallets only
    if (!needsTokensForAll && wallets.length > 0) {
      const paginatedWalletsBeforeTokens = wallets.slice(offset, offset + limit);
      const paginatedCreatorAddresses = paginatedWalletsBeforeTokens.map(w => w.address);
      
      if (paginatedCreatorAddresses.length > 0) {
        // Build WHERE clause for token query
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
          [paginatedCreatorAddresses]
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
          [paginatedCreatorAddresses]
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
        
        // Recalculate stats for paginated wallets now that we have token data
        // Update wallets in the original array by finding them by address
        for (const creatorAddress of paginatedCreatorAddresses) {
          const wallet = wallets.find(w => w.address === creatorAddress);
          if (wallet) {
            const tokens = tokensByCreator.get(creatorAddress) || [];
            const allTokens = allTokensByCreator.get(creatorAddress) || [];
            
            // Recalculate stats that require token data
            wallet.multiplierPercentages = Object.fromEntries(
              Array.from(calculateMultiplierPercentages(tokens).entries()).map(([key, value]) => [
                key,
                Math.round(value * 100) / 100
              ])
            );
            
            wallet.validTokenCount = tokens.filter(
              t => t.initialMarketCapUsd !== null && 
                   t.initialMarketCapUsd > 0 && 
                   t.athMarketCapUsd !== null && 
                   t.athMarketCapUsd > 0
            ).length;
            
            wallet.avgRugRate = Math.round(calculateRugRate(allTokens, rugThresholdMcap) * 100) / 100;
            wallet.avgRugTime = (() => {
              const time = calculateAvgRugTime(allTokens, rugThresholdMcap);
              return time !== null ? Math.round(time * 100) / 100 : null;
            })();
            
            // Extract minimum buy amount filters
            const { minBuyAmountSol, minBuyAmountToken } = extractMinBuyAmountFilters(filters);
            
            wallet.buySellStats = calculateBuySellStats(allTokens, minBuyAmountSol, minBuyAmountToken);
            wallet.expectedROI = calculateExpectedROI(allTokens);
            
            if (whatIfSettings && whatIfSettings.buyPosition && whatIfSettings.sellStrategy) {
              wallet.whatIfPnl = calculateWhatIfPNL(allTokens, whatIfSettings);
            }
            
            // Recalculate scores with updated stats
            if (scoringSettings) {
              const percentileRank = wallet.athMcapPercentileRank !== null ? wallet.athMcapPercentileRank / 100 : null;
              const multiplierPercentagesMap = calculateMultiplierPercentages(tokens);
              wallet.scores = calculateCreatorWalletScores(
                wallet.winRate,
                wallet.avgAthMcap,
                wallet.medianAthMcap,
                multiplierPercentagesMap,
                wallet.avgRugRate,
                wallet.avgRugTime,
                scoringSettings,
                allWalletsData,
                percentileRank
              );
              
              // Round scores
              wallet.scores = {
                winRateScore: Math.round(wallet.scores.winRateScore * 100) / 100,
                avgAthMcapScore: Math.round(wallet.scores.avgAthMcapScore * 100) / 100,
                medianAthMcapScore: Math.round(wallet.scores.medianAthMcapScore * 100) / 100,
                multiplierScore: Math.round(wallet.scores.multiplierScore * 100) / 100,
                avgRugRateScore: Math.round(wallet.scores.avgRugRateScore * 100) / 100,
                timeBucketRugRateScore: Math.round(wallet.scores.timeBucketRugRateScore * 100) / 100,
                individualMultiplierScores: Object.fromEntries(
                  Object.entries(wallet.scores.individualMultiplierScores).map(([key, value]) => [
                    parseFloat(key),
                    Math.round(value * 100) / 100
                  ])
                ),
                finalScore: Math.round(wallet.scores.finalScore * 100) / 100
              };
            }
          }
        }
      }
    }
    
    // Apply pagination to filtered results
    const paginatedWallets = wallets.slice(offset, offset + limit);
    
    // Calculate total token count from all filtered wallets (after all filters applied)
    const totalTokensCount = wallets.reduce((sum, wallet) => sum + wallet.totalTokens, 0);
    
    res.json({
      wallets: paginatedWallets,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        totalPages: Math.ceil(filteredTotal / limit)
      },
      totalTokens: totalTokensCount
    });
  } catch (error: any) {
    console.error('Error fetching creator wallets analytics:', error);
    res.status(500).json({
      error: 'Error fetching creator wallets analytics'
    });
  }
});

// Export tokens as CSV (streaming for large datasets)
router.get('/export', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const creatorWallet = req.query.creator as string || null;
    const viewAll = req.query.viewAll === 'true' || req.query.viewAll === '1';
    
    // Set headers for CSV download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tokens-${timestamp}.csv"`);
    
    // Build WHERE clause
    let whereClause = '';
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    if (viewAll) {
      if (creatorWallet) {
        whereClause = `WHERE ct.creator = $${paramIndex}`;
        queryParams.push(creatorWallet);
        paramIndex++;
      } else {
        whereClause = '';
      }
    } else {
      whereClause = 'WHERE ct.creator NOT IN (SELECT wallet_address FROM tbl_soltrack_blacklist_creator)';
      
      if (creatorWallet) {
        whereClause += ` AND ct.creator = $${paramIndex}`;
        queryParams.push(creatorWallet);
        paramIndex++;
      }
    }
    
    // Write CSV header
    const header = [
      'Token Name',
      'Symbol',
      'Mint Address',
      'Creator Wallet',
      'Bonding Curve',
      'Status',
      'Initial Market Cap (USD)',
      'Peak Market Cap (USD)',
      'Final Market Cap (USD)',
      'ATH Market Cap (USD)',
      'Trade Count (15s)',
      'Created At',
      'Create TX Signature',
      'Tracked At',
      'Updated At'
    ].map(field => `"${field.replace(/"/g, '""')}"`).join(',') + '\n';
    
    res.write(header);
    
    // Stream data in chunks to avoid memory issues
    const BATCH_SIZE = 1000; // Process 1000 records at a time
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const result = await pool.query(
        `SELECT 
          ct.mint,
          ct.name,
          ct.symbol,
          ct.creator,
          ct.bonding_curve,
          ct.created_at,
          ct.create_tx_signature,
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
        [...queryParams, BATCH_SIZE, offset]
      );
      
      if (result.rows.length === 0) {
        hasMore = false;
        break;
      }
      
      // Convert rows to CSV and write
      for (const row of result.rows) {
        const csvRow = [
          row.name || 'Unnamed Token',
          row.symbol || '',
          row.mint || '',
          row.creator || '',
          row.bonding_curve || '',
          row.bonded ? 'Bonded' : 'Bonding',
          row.initial_market_cap_usd !== null ? row.initial_market_cap_usd : 'N/A',
          row.peak_market_cap_usd !== null ? row.peak_market_cap_usd : 'N/A',
          row.final_market_cap_usd !== null ? row.final_market_cap_usd : 'N/A',
          row.ath_market_cap_usd !== null ? row.ath_market_cap_usd : 'N/A',
          row.trade_count_15s || 0,
          row.created_at || '',
          row.create_tx_signature || '',
          row.tracked_at || '',
          row.updated_at || ''
        ].map(field => {
          const str = String(field);
          return `"${str.replace(/"/g, '""')}"`;
        }).join(',') + '\n';
        
        res.write(csvRow);
      }
      
      offset += BATCH_SIZE;
      
      // If we got fewer rows than requested, we're done
      if (result.rows.length < BATCH_SIZE) {
        hasMore = false;
      }
    }
    
    res.end();
  } catch (error: any) {
    console.error('Error exporting tokens:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Error exporting tokens' 
      });
    } else {
      res.end();
    }
  }
});

// Export creator wallets as CSV (streaming for large datasets)
router.post('/creators/export', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const viewAll = req.query.viewAll === 'true' || req.query.viewAll === '1';
    const filters = req.body?.filters || {};
    const whatIfSettings = req.body?.whatIfSettings || null;
    
    // Set headers for CSV download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="creator-wallets-${timestamp}.csv"`);
    
    // Get applied scoring settings (same logic as analytics endpoint)
    let scoringSettings: any = null;
    try {
      const settingsResult = await pool.query(
        `SELECT settings
         FROM tbl_soltrack_applied_settings
         ORDER BY applied_at DESC
         LIMIT 1`
      );
      
      if (settingsResult.rows.length === 0) {
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
    }
    
    // Build base WHERE clause
    let baseWhereClause = '';
    if (!viewAll) {
      baseWhereClause = 'WHERE ct.creator NOT IN (SELECT wallet_address FROM tbl_soltrack_blacklist_creator)';
    }
    
    const rugThresholdMcap = scoringSettings?.rugThresholdMcap || 6000;
    
    // Build SQL-level filters (same logic as analytics endpoint)
    const sqlFilterConditions: string[] = [];
    const sqlFilterParams: any[] = [];
    let paramIndex = 1;
    
    if (filters.totalTokens) {
      if (filters.totalTokens.min !== undefined && filters.totalTokens.min !== null) {
        sqlFilterConditions.push(`COUNT(*) >= $${paramIndex}`);
        sqlFilterParams.push(filters.totalTokens.min);
        paramIndex++;
      }
      if (filters.totalTokens.max !== undefined && filters.totalTokens.max !== null) {
        sqlFilterConditions.push(`COUNT(*) <= $${paramIndex}`);
        sqlFilterParams.push(filters.totalTokens.max);
        paramIndex++;
      }
    }
    
    if (filters.bondedTokens) {
      if (filters.bondedTokens.min !== undefined && filters.bondedTokens.min !== null) {
        sqlFilterConditions.push(`COUNT(*) FILTER (WHERE ct.bonded = true) >= $${paramIndex}`);
        sqlFilterParams.push(filters.bondedTokens.min);
        paramIndex++;
      }
      if (filters.bondedTokens.max !== undefined && filters.bondedTokens.max !== null) {
        sqlFilterConditions.push(`COUNT(*) FILTER (WHERE ct.bonded = true) <= $${paramIndex}`);
        sqlFilterParams.push(filters.bondedTokens.max);
        paramIndex++;
      }
    }
    
    if (filters.winRate && Array.isArray(filters.winRate) && filters.winRate.length > 0) {
      for (const filter of filters.winRate) {
        if (filter.type === 'percent') {
          if (filter.min !== undefined && filter.min !== null) {
            sqlFilterConditions.push(`(COUNT(*) FILTER (WHERE ct.bonded = true)::DECIMAL / NULLIF(COUNT(*)::DECIMAL, 0) * 100) >= $${paramIndex}`);
            sqlFilterParams.push(filter.min);
            paramIndex++;
          }
          if (filter.max !== undefined && filter.max !== null) {
            sqlFilterConditions.push(`(COUNT(*) FILTER (WHERE ct.bonded = true)::DECIMAL / NULLIF(COUNT(*)::DECIMAL, 0) * 100) <= $${paramIndex}`);
            sqlFilterParams.push(filter.max);
            paramIndex++;
          }
        }
      }
    }
    
    if (filters.avgMcap && Array.isArray(filters.avgMcap) && filters.avgMcap.length > 0) {
      for (const filter of filters.avgMcap) {
        if (filter.type === 'mcap') {
          if (filter.min !== undefined && filter.min !== null) {
            sqlFilterConditions.push(`AVG(ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL) >= $${paramIndex}`);
            sqlFilterParams.push(filter.min);
            paramIndex++;
          }
          if (filter.max !== undefined && filter.max !== null) {
            sqlFilterConditions.push(`AVG(ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL) <= $${paramIndex}`);
            sqlFilterParams.push(filter.max);
            paramIndex++;
          }
        }
      }
    }
    
    if (filters.medianMcap && Array.isArray(filters.medianMcap) && filters.medianMcap.length > 0) {
      for (const filter of filters.medianMcap) {
        if (filter.type === 'mcap') {
          if (filter.min !== undefined && filter.min !== null) {
            sqlFilterConditions.push(`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL AND ct.ath_market_cap_usd > 0) >= $${paramIndex}`);
            sqlFilterParams.push(filter.min);
            paramIndex++;
          }
          if (filter.max !== undefined && filter.max !== null) {
            sqlFilterConditions.push(`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL AND ct.ath_market_cap_usd > 0) <= $${paramIndex}`);
            sqlFilterParams.push(filter.max);
            paramIndex++;
          }
        }
      }
    }
    
    const havingClause = sqlFilterConditions.length > 0 
      ? `HAVING ${sqlFilterConditions.join(' AND ')}`
      : '';
    
    // Get all wallets data for percentile calculation
    const allWalletsResult = await pool.query(
      `SELECT 
        ct.creator,
        AVG(ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL) as avg_ath_mcap,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL AND ct.ath_market_cap_usd > 0) as median_ath_mcap
      FROM tbl_soltrack_created_tokens ct
      ${baseWhereClause}
      GROUP BY ct.creator`
    );
    
    const allWalletsData = allWalletsResult.rows.map(row => ({
      avgAthMcap: row.avg_ath_mcap ? parseFloat(row.avg_ath_mcap) : null,
      medianAthMcap: row.median_ath_mcap ? parseFloat(row.median_ath_mcap) : null
    }));
    
    const allAvgAthValues = allWalletsData
      .map(w => w.avgAthMcap)
      .filter((v): v is number => v !== null && v > 0)
      .sort((a, b) => a - b);
    
    // Get all filtered wallets (we need to fetch all for export, but process in batches)
    const walletsResult = await pool.query(
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
      ${baseWhereClause}
      GROUP BY ct.creator
      ${havingClause}
      ORDER BY win_rate DESC, total_tokens DESC`,
      sqlFilterParams
    );
    
    // Build CSV header
    const headerFields = [
      'Wallet Address',
      'Total Tokens',
      'Valid Token Count',
      'Bonded Tokens',
      'Win Rate (%)',
      'Win Rate Score',
      'Avg ATH MCap',
      'Avg ATH MCap Score',
      'Median ATH MCap',
      'Median ATH MCap Score',
      'ATH MCap Percentile Rank',
      '25th Percentile',
      '50th Percentile',
      '75th Percentile',
      '90th Percentile',
      'Avg Buy Count',
      'Avg Buy Total SOL',
      'Avg Sell Count',
      'Avg Sell Total SOL',
      'Expected ROI 1st Buy',
      'Expected ROI 2nd Buy',
      'Expected ROI 3rd Buy',
      'Avg Rug Rate (%)',
      'Avg Rug Rate Score',
      'Avg Rug Time (seconds)',
      'Time Bucket Rug Rate Score',
      'Multiplier Score',
      'Final Score'
    ];
    
    // Add What If columns if settings provided
    const showWhatIf = whatIfSettings && whatIfSettings.buyPosition && whatIfSettings.sellStrategy;
    if (showWhatIf) {
      headerFields.push('What If Avg PNL', 'What If Avg PNL %', 'What If Tokens Simulated');
    }
    
    // Add multiplier columns (common multipliers: 1.5, 2, 3, 5, 10)
    const multipliers = [1.5, 2, 3, 5, 10];
    multipliers.forEach(mult => {
      headerFields.push(`${mult}x Multiplier %`);
    });
    multipliers.forEach(mult => {
      headerFields.push(`${mult}x Multiplier Score`);
    });
    
    // Add multiplier columns (we'll determine these from the first wallet)
    const header = headerFields.map(field => `"${field.replace(/"/g, '""')}"`).join(',') + '\n';
    res.write(header);
    
    // Process wallets in batches to avoid memory issues
    const BATCH_SIZE = 100; // Process 100 wallets at a time
    const totalWallets = walletsResult.rows.length;
    
    for (let i = 0; i < totalWallets; i += BATCH_SIZE) {
      const batch = walletsResult.rows.slice(i, i + BATCH_SIZE);
      const batchAddresses = batch.map(row => row.address);
      
      // Fetch tokens for this batch
      let tokenWhereClause = 'WHERE ct.creator = ANY($1::text[])';
      if (!viewAll) {
        tokenWhereClause += ' AND ct.creator NOT IN (SELECT wallet_address FROM tbl_soltrack_blacklist_creator)';
      }
      
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
        [batchAddresses]
      );
      
      const allTokensResult = await pool.query(
        `SELECT 
          ct.creator,
          ct.ath_market_cap_usd,
          ct.is_fetched,
          ct.created_at,
          ct.market_cap_time_series
        FROM tbl_soltrack_created_tokens ct
        ${tokenWhereClause}`,
        [batchAddresses]
      );
      
      // Group tokens by creator
      const tokensByCreator = new Map<string, Array<{ initialMarketCapUsd: number | null; athMarketCapUsd: number | null }>>();
      const allTokensByCreator = new Map<string, Array<{ 
        athMarketCapUsd: number | null;
        isFetched: boolean;
        createdAt: Date;
        marketCapTimeSeries: any;
      }>>();
      
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
      
      // Process each wallet in the batch
      for (const row of batch) {
        const winRate = parseFloat(row.win_rate) || 0;
        const avgAthMcap = row.avg_ath_mcap ? parseFloat(row.avg_ath_mcap) : null;
        const medianAthMcap = row.median_ath_mcap ? parseFloat(row.median_ath_mcap) : null;
        
        let percentileRank: number | null = null;
        if (avgAthMcap !== null && avgAthMcap > 0 && allAvgAthValues.length > 0) {
          percentileRank = calculatePercentile(avgAthMcap, allAvgAthValues);
        }
        
        const tokens = tokensByCreator.get(row.address) || [];
        const allTokens = allTokensByCreator.get(row.address) || [];
        
        const multiplierPercentages = calculateMultiplierPercentages(tokens);
        const validTokenCount = tokens.filter(
          t => t.initialMarketCapUsd !== null && 
               t.initialMarketCapUsd > 0 && 
               t.athMarketCapUsd !== null && 
               t.athMarketCapUsd > 0
        ).length;
        
        const avgRugRate = calculateRugRate(allTokens, rugThresholdMcap);
        const avgRugTime = calculateAvgRugTime(allTokens, rugThresholdMcap);
        
        // Extract minimum buy amount filters
        const { minBuyAmountSol, minBuyAmountToken } = extractMinBuyAmountFilters(filters);
        
        const buySellStats = calculateBuySellStats(allTokens, minBuyAmountSol, minBuyAmountToken);
        const expectedROI = calculateExpectedROI(allTokens);
        
        let whatIfPnl = null;
        if (showWhatIf && whatIfSettings) {
          whatIfPnl = calculateWhatIfPNL(allTokens, whatIfSettings);
        }
        
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
        
        // Build CSV row
        const rowData: any[] = [
          row.address,
          parseInt(row.total_tokens) || 0,
          validTokenCount,
          parseInt(row.bonded_tokens) || 0,
          winRate.toFixed(2),
          scores.winRateScore.toFixed(2),
          avgAthMcap !== null ? avgAthMcap : 'N/A',
          scores.avgAthMcapScore.toFixed(2),
          medianAthMcap !== null ? medianAthMcap : 'N/A',
          scores.medianAthMcapScore.toFixed(2),
          percentileRank !== null ? percentileRank.toFixed(1) : 'N/A',
          percentileRank !== null && percentileRank <= 25 ? 'Yes' : 'No',
          percentileRank !== null && percentileRank <= 50 ? 'Yes' : 'No',
          percentileRank !== null && percentileRank <= 75 ? 'Yes' : 'No',
          percentileRank !== null && percentileRank > 75 ? 'Yes' : 'No',
          buySellStats.avgBuyCount.toFixed(2),
          buySellStats.avgBuyTotalSol.toFixed(4),
          buySellStats.avgSellCount.toFixed(2),
          buySellStats.avgSellTotalSol.toFixed(4),
          expectedROI.avgRoi1stBuy.toFixed(2),
          expectedROI.avgRoi2ndBuy.toFixed(2),
          expectedROI.avgRoi3rdBuy.toFixed(2),
          avgRugRate.toFixed(2),
          scores.avgRugRateScore.toFixed(2),
          avgRugTime !== null ? avgRugTime.toFixed(2) : 'N/A',
          scores.timeBucketRugRateScore.toFixed(2),
          scores.multiplierScore.toFixed(2),
          scores.finalScore.toFixed(2)
        ];
        
        if (showWhatIf && whatIfPnl) {
          rowData.push(
            whatIfPnl.avgPnl.toFixed(2),
            whatIfPnl.avgPnlPercent.toFixed(2),
            whatIfPnl.tokensSimulated
          );
        }
        
        // Add multiplier percentages and scores (we'll use common multipliers: 1.5, 2, 3, 5, 10)
        const multipliers = [1.5, 2, 3, 5, 10];
        for (const mult of multipliers) {
          const percentage = multiplierPercentages.get(mult) || 0;
          rowData.push(percentage.toFixed(2));
        }
        for (const mult of multipliers) {
          const score = scores.individualMultiplierScores[mult] || 0;
          rowData.push(score.toFixed(2));
        }
        
        const csvRow = rowData.map(field => {
          const str = String(field);
          return `"${str.replace(/"/g, '""')}"`;
        }).join(',') + '\n';
        
        res.write(csvRow);
      }
    }
    
    res.end();
  } catch (error: any) {
    console.error('Error exporting creator wallets:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Error exporting creator wallets' 
      });
    } else {
      res.end();
    }
  }
});

export default router;


