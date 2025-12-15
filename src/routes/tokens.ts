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

// Calculate scores for each metric for a creator wallet
function calculateCreatorWalletScores(
  winRate: number,
  avgAthMcap: number | null,
  medianAthMcap: number | null,
  settings: any,
  allWalletsData: Array<{ avgAthMcap: number | null; medianAthMcap: number | null }>
): {
  winRateScore: number;
  avgAthMcapScore: number;
  medianAthMcapScore: number;
  finalScore: number;
} {
  let winRateScore = 0;
  let avgAthMcapScore = 0;
  let medianAthMcapScore = 0;
  
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
  
  const finalScore = winRateScore + avgAthMcapScore + medianAthMcapScore;
  
  return {
    winRateScore,
    avgAthMcapScore,
    medianAthMcapScore,
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
    
    // First, get ALL wallets data to calculate percentiles (not just paginated ones)
    const allWalletsResult = await pool.query(
      `SELECT 
        AVG(ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL) as avg_ath_mcap,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL) as median_ath_mcap
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
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ct.ath_market_cap_usd) FILTER (WHERE ct.ath_market_cap_usd IS NOT NULL) as median_ath_mcap
      FROM tbl_soltrack_created_tokens ct
      ${whereClause}
      GROUP BY ct.creator
      ORDER BY win_rate DESC, total_tokens DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    // Calculate scores and create wallet objects
    const walletsWithScores = result.rows.map(row => {
      const winRate = parseFloat(row.win_rate) || 0;
      const avgAthMcap = row.avg_ath_mcap ? parseFloat(row.avg_ath_mcap) : null;
      const medianAthMcap = row.median_ath_mcap ? parseFloat(row.median_ath_mcap) : null;
      
      // Calculate scores if settings are available
      let scores = {
        winRateScore: 0,
        avgAthMcapScore: 0,
        medianAthMcapScore: 0,
        finalScore: 0
      };
      
      if (scoringSettings) {
        scores = calculateCreatorWalletScores(winRate, avgAthMcap, medianAthMcap, scoringSettings, allWalletsData);
      }
      
      return {
        address: row.address,
        totalTokens: parseInt(row.total_tokens) || 0,
        bondedTokens: parseInt(row.bonded_tokens) || 0,
        winRate,
        avgAthMcap,
        medianAthMcap,
        scores: {
          winRateScore: Math.round(scores.winRateScore * 100) / 100,
          avgAthMcapScore: Math.round(scores.avgAthMcapScore * 100) / 100,
          medianAthMcapScore: Math.round(scores.medianAthMcapScore * 100) / 100,
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


