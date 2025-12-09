import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db.js';

const router = Router();

// Get all created tokens with their 15-second market cap data
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.session as any)?.userId || 'admin';
    
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
      // Normal mode: filter by creator wallets
      whereClause = 'WHERE ct.creator IN (SELECT wallet_address FROM creator_wallets WHERE user_id = $1)';
      queryParams.push(userId);
      paramIndex = 2;
      
      if (creatorWallet) {
        whereClause += ` AND ct.creator = $${paramIndex}`;
        queryParams.push(creatorWallet);
        paramIndex++;
      }
    }
    
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM created_tokens ct
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
      FROM created_tokens ct
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
    const userId = (req.session as any)?.userId || 'admin';
    
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
      FROM created_tokens ct
      WHERE ct.mint = $1 
        AND ct.creator IN (
          SELECT wallet_address 
          FROM creator_wallets 
          WHERE user_id = $2
        )
      LIMIT 1`,
      [mint, userId]
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

// Get distinct creator wallets from created_tokens
router.get('/creators/list', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.session as any)?.userId || 'admin';
    const viewAll = req.query.viewAll === 'true' || req.query.viewAll === '1';
    
    let query: string;
    let params: any[];
    
    if (viewAll) {
      // Show all creator wallets that have tokens
      query = `
        SELECT DISTINCT ct.creator as address
        FROM created_tokens ct
        ORDER BY ct.creator ASC
      `;
      params = [];
    } else {
      // Show only creator wallets that have tokens AND are in the user's tracked wallets
      query = `
        SELECT DISTINCT ct.creator as address
        FROM created_tokens ct
        WHERE ct.creator IN (
          SELECT wallet_address 
          FROM creator_wallets 
          WHERE user_id = $1
        )
        ORDER BY ct.creator ASC
      `;
      params = [userId];
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

export default router;

