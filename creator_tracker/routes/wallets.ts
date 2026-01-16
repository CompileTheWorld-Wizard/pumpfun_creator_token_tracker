import { Router, Request, Response } from 'express';
import { PublicKey, Connection } from '@solana/web3.js';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db.js';
import { updateBondingStatusForCreator } from '../services/bondingTracker.js';
import { updateAthMcapForCreator } from '../services/athTracker.js';

const router = Router();

// Solana RPC endpoint
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Validate wallet address endpoint
router.post('/validate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { address } = req.body;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ 
        valid: false, 
        error: 'Wallet address is required' 
      });
    }

    const trimmed = address.trim();

    // Validate using PublicKey constructor
    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(trimmed);
      
      // Check if it's on curve (valid public key format)
      const isOnCurve = PublicKey.isOnCurve(publicKey.toBytes());
      if (!isOnCurve) {
        return res.status(400).json({ 
          valid: false, 
          error: 'Invalid wallet address format' 
        });
      }
    } catch (error) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Invalid Solana address format' 
      });
    }

    // Check account type via RPC to ensure it's a wallet (not a program or token account)
    try {
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const accountInfo = await connection.getAccountInfo(publicKey);

      if (!accountInfo) {
        // Account doesn't exist - could be a new wallet, we'll accept it
        return res.json({ valid: true });
      }

      // Check if it's an executable program
      if (accountInfo.executable) {
        return res.status(400).json({ 
          valid: false, 
          error: 'This is a program address, not a wallet address' 
        });
      }

      // Check if it's a token account (token accounts have specific data layout)
      const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      if (accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        return res.status(400).json({ 
          valid: false, 
          error: 'This is a token account address, not a wallet address' 
        });
      }

      // Check if it's an associated token account
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
      if (accountInfo.owner.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
        return res.status(400).json({ 
          valid: false, 
          error: 'This is an associated token account, not a wallet address' 
        });
      }

      // If it's a valid account that's not a program or token account, it's likely a wallet
      return res.json({ valid: true });
    } catch (error: any) {
      // If RPC check fails, fall back to basic validation
      console.warn('RPC validation failed, using basic validation:', error.message);
      return res.json({ valid: true });
    }
  } catch (error: any) {
    console.error('Error validating wallet:', error);
    return res.status(500).json({ 
      valid: false, 
      error: 'Error validating wallet address. Please try again.' 
    });
  }
});

// Get all blacklist wallets for the authenticated user
router.get('/', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT wallet_address, name as nickname FROM tbl_soltrack_blacklist_creator ORDER BY created_at DESC'
    );
    
    const wallets = result.rows.map(row => ({
      address: row.wallet_address,
      nickname: row.nickname || null
    }));
    res.json({ wallets });
  } catch (error: any) {
    console.error('Error fetching blacklist wallets:', error);
    res.status(500).json({ 
      error: 'Error fetching blacklist wallets' 
    });
  }
});

// Add a blacklist wallet
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { address, nickname } = req.body;

    if (!address || typeof address !== 'string') {
      res.status(400).json({ 
        error: 'Wallet address is required' 
      });
      return;
    }

    const trimmed = address.trim();
    const trimmedNickname = nickname ? String(nickname).trim() : null;

    // Validate using PublicKey constructor
    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(trimmed);
      
      // Check if it's on curve (valid public key format)
      const isOnCurve = PublicKey.isOnCurve(publicKey.toBytes());
      if (!isOnCurve) {
        res.status(400).json({ 
          error: 'Invalid wallet address format' 
        });
        return;
      }
    } catch (error) {
      res.status(400).json({ 
        error: 'Invalid Solana address format' 
      });
      return;
    }

    // Check account type via RPC to ensure it's a wallet (not a program or token account)
    try {
      const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
      const accountInfo = await connection.getAccountInfo(publicKey);

      if (accountInfo) {
        // Check if it's an executable program
        if (accountInfo.executable) {
          res.status(400).json({ 
            error: 'This is a program address, not a wallet address' 
          });
          return;
        }

        // Check if it's a token account
        const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        if (accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
          res.status(400).json({ 
            error: 'This is a token account address, not a wallet address' 
          });
          return;
        }

        // Check if it's an associated token account
        const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
        if (accountInfo.owner.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
          res.status(400).json({ 
            error: 'This is an associated token account, not a wallet address' 
          });
          return;
        }
      }
    } catch (error: any) {
      // If RPC check fails, fall back to basic validation
      console.warn('RPC validation failed, using basic validation:', error.message);
    }

    // Insert wallet into database
    try {
      await pool.query(
        'INSERT INTO tbl_soltrack_blacklist_creator (wallet_address, name) VALUES ($1, $2)',
        [trimmed, trimmedNickname]
      );
      
      res.json({ 
        success: true, 
        message: 'Blacklist wallet added successfully' 
      });
    } catch (dbError: any) {
      // Check if it's a unique constraint violation
      if (dbError.code === '23505') {
        res.status(400).json({ 
          error: 'This wallet address is already in the blacklist' 
        });
        return;
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error adding blacklist wallet:', error);
    res.status(500).json({ 
      error: 'Error adding blacklist wallet. Please try again.' 
    });
  }
});

// Delete a blacklist wallet
router.delete('/:address', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { address } = req.params;

    if (!address) {
      res.status(400).json({ 
        error: 'Wallet address is required' 
      });
      return;
    }

    const result = await pool.query(
      'DELETE FROM tbl_soltrack_blacklist_creator WHERE wallet_address = $1',
      [address]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ 
        error: 'Wallet address not found in blacklist' 
      });
      return;
    }

    res.json({ 
      success: true, 
      message: 'Blacklist wallet removed successfully' 
    });
  } catch (error: any) {
    console.error('Error deleting blacklist wallet:', error);
    res.status(500).json({ 
      error: 'Error deleting blacklist wallet. Please try again.' 
    });
  }
});

// Get wallet statistics (bonded rate and average ATH mcap)
router.get('/:address/stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { address } = req.params;

    if (!address) {
      res.status(400).json({ 
        error: 'Wallet address is required' 
      });
      return;
    }

    // Check if wallet has any tokens in tbl_soltrack_created_tokens
    const tokenCheck = await pool.query(
      'SELECT COUNT(*) as count FROM tbl_soltrack_created_tokens WHERE creator = $1',
      [address]
    );

    const tokenCount = parseInt(tokenCheck.rows[0].count) || 0;
    if (tokenCount === 0) {
      res.status(404).json({ 
        error: 'No tokens found for this wallet address' 
      });
      return;
    }

    // Check if wallet is in blacklist (for updating stats)
    const walletCheck = await pool.query(
      'SELECT wallet_address FROM tbl_soltrack_blacklist_creator WHERE wallet_address = $1',
      [address]
    );

    const isBlacklisted = walletCheck.rows.length > 0;

    // Update bonding status and ATH mcap for tokens from this creator wallet
    // Only update if wallet is blacklisted (to refresh stats)
    if (isBlacklisted) {
      try {
        await Promise.all([
          updateBondingStatusForCreator(address).catch(err => {
            console.error(`[Wallets] Error updating bonding status:`, err);
          }),
          updateAthMcapForCreator(address).catch(err => {
            console.error(`[Wallets] Error updating ATH mcap:`, err);
          })
        ]);
      } catch (error) {
        console.error(`[Wallets] Error updating stats for creator ${address}:`, error);
        // Continue to return stats even if update fails
      }
    }

    // Get statistics for tokens created by this wallet
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_tokens,
        COUNT(*) FILTER (WHERE bonded = true) as bonded_tokens,
        AVG(ath_market_cap_usd) FILTER (WHERE ath_market_cap_usd IS NOT NULL) as avg_ath_mcap
      FROM tbl_soltrack_created_tokens
      WHERE creator = $1`,
      [address]
    );

    const stats = statsResult.rows[0];
    const totalTokens = parseInt(stats.total_tokens) || 0;
    const bondedTokens = parseInt(stats.bonded_tokens) || 0;
    const bondedRate = totalTokens > 0 ? (bondedTokens / totalTokens) * 100 : 0;
    const avgAthMcap = stats.avg_ath_mcap ? parseFloat(stats.avg_ath_mcap) : null;

    res.json({
      totalTokens,
      bondedTokens,
      bondedRate: Math.round(bondedRate * 100) / 100, // Round to 2 decimal places
      avgAthMcap
    });
  } catch (error: any) {
    console.error('Error fetching wallet statistics:', error);
    res.status(500).json({ 
      error: 'Error fetching wallet statistics. Please try again.' 
    });
  }
});

// Get wallets that received more than X SOL from a creator wallet
router.get('/:address/receivers', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { address } = req.params;
    const minAmount = parseFloat(req.query.minAmount as string) || 0;
    const limit = parseInt(req.query.limit as string) || 3;

    if (!address) {
      res.status(400).json({ 
        error: 'Wallet address is required' 
      });
      return;
    }

    // Query the fund tracking database for wallets that received SOL from this creator wallet
    // Note: This assumes both databases are in the same PostgreSQL instance
    const query = `
      SELECT 
        receiver as address,
        SUM(amount)::numeric as total_received
      FROM tbl_fund_sol_transfers
      WHERE sender = $1
      GROUP BY receiver
      HAVING SUM(amount) > $2
      ORDER BY total_received DESC
      LIMIT $3
    `;

    const result = await pool.query(query, [address, minAmount, limit]);
    
    res.json({ 
      wallets: result.rows.map(row => ({
        address: row.address,
        totalReceived: parseFloat(row.total_received)
      }))
    });
  } catch (error: any) {
    console.error('Error fetching receiver wallets:', error);
    res.status(500).json({ 
      error: 'Error fetching receiver wallets. Please try again.' 
    });
  }
});

export default router;

