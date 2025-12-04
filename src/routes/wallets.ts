import { Router, Request, Response } from 'express';
import { PublicKey, Connection } from '@solana/web3.js';
import { requireAuth } from '../middleware/auth';
import { pool } from '../db';

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

// Get all creator wallets for the authenticated user
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.session as any)?.userId || 'admin';
    
    const result = await pool.query(
      'SELECT wallet_address FROM creator_wallets WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    const wallets = result.rows.map(row => row.wallet_address);
    res.json({ wallets });
  } catch (error: any) {
    console.error('Error fetching creator wallets:', error);
    res.status(500).json({ 
      error: 'Error fetching creator wallets' 
    });
  }
});

// Add a creator wallet
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { address } = req.body;
    const userId = (req.session as any)?.userId || 'admin';

    if (!address || typeof address !== 'string') {
      res.status(400).json({ 
        error: 'Wallet address is required' 
      });
      return;
    }

    const trimmed = address.trim();

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
        'INSERT INTO creator_wallets (user_id, wallet_address) VALUES ($1, $2)',
        [userId, trimmed]
      );
      
      res.json({ 
        success: true, 
        message: 'Creator wallet added successfully' 
      });
    } catch (dbError: any) {
      // Check if it's a unique constraint violation
      if (dbError.code === '23505') {
        res.status(400).json({ 
          error: 'This wallet address is already added' 
        });
        return;
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error adding creator wallet:', error);
    res.status(500).json({ 
      error: 'Error adding creator wallet. Please try again.' 
    });
  }
});

// Delete a creator wallet
router.delete('/:address', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { address } = req.params;
    const userId = (req.session as any)?.userId || 'admin';

    if (!address) {
      res.status(400).json({ 
        error: 'Wallet address is required' 
      });
      return;
    }

    const result = await pool.query(
      'DELETE FROM creator_wallets WHERE user_id = $1 AND wallet_address = $2',
      [userId, address]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ 
        error: 'Wallet address not found' 
      });
      return;
    }

    res.json({ 
      success: true, 
      message: 'Creator wallet removed successfully' 
    });
  } catch (error: any) {
    console.error('Error deleting creator wallet:', error);
    res.status(500).json({ 
      error: 'Error deleting creator wallet. Please try again.' 
    });
  }
});

export default router;

