/**
 * Bonding Tracker Service
 * 
 * Tracks token bonding status (migration to AMM/Raydium) using Shyft GraphQL API.
 * Updates bonding status when tokens migrate from bonding curve to AMM.
 */

import dotenv from 'dotenv';
import { pool } from '../db.js';
import { setPoolToMintMapping } from '../streams/pumpfun.js';

dotenv.config();

const SHYFT_API_KEY = process.env.SHYFT_API_KEY || "C5WUfQxUvSmrEBES";
const SHYFT_GQL_ENDPOINT = `https://programs.shyft.to/v0/graphql/accounts?api_key=${SHYFT_API_KEY}&network=mainnet-beta`;
const BATCH_SIZE = 50; // Fetch 50 tokens per API call

interface PoolData {
  base_mint: string;
  creator: string;
  index: number;
  lp_mint: string;
  lp_supply: string;
  pool_base_token_account: string;
  pool_bump: number;
  pool_quote_token_account: string;
  quote_mint: string;
  pubkey: string;
}

interface ShyftResponse {
  errors?: any[];
  data?: {
    pump_fun_amm_Pool?: PoolData[];
  };
}

let isInitialized = false;

/**
 * GraphQL query to fetch pools for multiple tokens
 */
function getPoolsQuery(): string {
  return `
    query MyQuery($tokens: [String!]!) {
      pump_fun_amm_Pool(
        where: {
          _or: [
            {
              _or: {base_mint: {_in: $tokens}}
            }, 
            {
              _or: {quote_mint: {_in: $tokens}}
            }
          ]
        }
      ) {
        base_mint
        creator
        index
        lp_mint
        lp_supply
        pool_base_token_account
        pool_bump
        pool_quote_token_account
        quote_mint
        pubkey
      }
    }
  `;
}

/**
 * Fetch bonding status for a batch of tokens from Shyft API
 * Returns both bonding status and pool information
 */
export async function fetchBondingStatusBatch(tokenMints: string[]): Promise<{
  bondingStatusMap: Map<string, boolean>;
  poolInfoMap: Map<string, { pool: string; base_mint: string; quote_mint: string }>;
}> {
  const bondingStatusMap = new Map<string, boolean>();
  const poolInfoMap = new Map<string, { pool: string; base_mint: string; quote_mint: string }>();

  if (tokenMints.length === 0) {
    return { bondingStatusMap, poolInfoMap };
  }

  try {
    const query = getPoolsQuery();
    const response = await fetch(SHYFT_GQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query,
        variables: {
          tokens: tokenMints,
        },
        operationName: "MyQuery",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      console.error(`[BondingTracker] API request failed with status ${response.status}:`, errorText);
      return { bondingStatusMap, poolInfoMap };
    }

    const result = (await response.json()) as ShyftResponse;

    if (result.errors) {
      console.error('[BondingTracker] GraphQL errors:', result.errors);
      return { bondingStatusMap, poolInfoMap };
    }

    // Process pool data - if a token has a pool, it's bonded
    const pools = result.data?.pump_fun_amm_Pool || [];
    const bondedMints = new Set<string>();
    
    for (const poolData of pools) {
      // Both base_mint and quote_mint could be our tracked tokens
      if (tokenMints.includes(poolData.base_mint)) {
        bondedMints.add(poolData.base_mint);
        poolInfoMap.set(poolData.base_mint, {
          pool: poolData.pubkey,
          base_mint: poolData.base_mint,
          quote_mint: poolData.quote_mint
        });
        // Store pool -> mint mapping for buy/sell events
        setPoolToMintMapping(poolData.pubkey, poolData.base_mint);
      }
    }

    // Set bonding status for all tokens in the batch
    for (const mint of tokenMints) {
      const isBonded = bondedMints.has(mint);
      bondingStatusMap.set(mint, isBonded);
    }

    return { bondingStatusMap, poolInfoMap };
  } catch (error) {
    console.error('[BondingTracker] Error fetching bonding status:', error);
    if (error instanceof Error) {
      console.error('[BondingTracker] Error stack:', error.stack);
    }
    return { bondingStatusMap, poolInfoMap };
  }
}

/**
 * Get all unbonded tokens from database
 * Excludes tokens created by blacklisted wallets
 */
async function getUnbondedTokens(): Promise<string[]> {
  try {
    const result = await pool.query(
      `SELECT mint 
       FROM tbl_soltrack_created_tokens
       WHERE creator NOT IN (SELECT wallet_address FROM tbl_soltrack_blacklist_creator)
         AND COALESCE(bonded, false) = false
       ORDER BY created_at DESC`
    );

    return result.rows.map((row) => row.mint);
  } catch (error) {
    console.error('[BondingTracker] Error fetching unbonded tokens:', error);
    if (error instanceof Error) {
      console.error('[BondingTracker] Error stack:', error.stack);
    }
    return [];
  }
}

/**
 * Update bonding status for tokens in database
 */
async function updateBondingStatus(
  mintAddresses: string[],
  bonded: boolean
): Promise<void> {
  if (mintAddresses.length === 0) {
    return;
  }

  try {
    // Update multiple tokens at once using IN clause
    const placeholders = mintAddresses.map((_, i) => `$${i + 1}`).join(', ');
    await pool.query(
      `UPDATE tbl_soltrack_created_tokens 
       SET bonded = $${mintAddresses.length + 1}, 
           updated_at = NOW()
       WHERE mint IN (${placeholders})`,
      [...mintAddresses, bonded]
    );
  } catch (error) {
    console.error('[BondingTracker] Error updating bonding status:', error);
    throw error;
  }
}

/**
 * Update bonding status with pool information for tokens in database
 */
async function updateBondingStatusWithPoolInfo(
  mintAddresses: string[],
  poolInfoMap: Map<string, { pool: string; base_mint: string; quote_mint: string }>
): Promise<void> {
  if (mintAddresses.length === 0) {
    return;
  }

  try {
    // Update each token individually to set pool information
    for (const mint of mintAddresses) {
      const poolInfo = poolInfoMap.get(mint);
      if (poolInfo) {
        await pool.query(
          `UPDATE tbl_soltrack_created_tokens 
           SET bonded = true,
               pool_address = $2,
               base_mint = $3,
               quote_mint = $4,
               updated_at = NOW()
           WHERE mint = $1`,
          [mint, poolInfo.pool, poolInfo.base_mint, poolInfo.quote_mint]
        );
        // Store pool -> mint mapping for buy/sell events
        setPoolToMintMapping(poolInfo.pool, poolInfo.base_mint);
      } else {
        // Fallback to basic update if pool info not available
        await pool.query(
          `UPDATE tbl_soltrack_created_tokens 
           SET bonded = true,
               updated_at = NOW()
           WHERE mint = $1`,
          [mint]
        );
      }
    }
  } catch (error) {
    console.error('[BondingTracker] Error updating bonding status with pool info:', error);
    if (error instanceof Error) {
      console.error('[BondingTracker] Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * Fetch bonding status for all unbonded tokens in batches
 */
async function fetchBondingStatusForAllTokens(): Promise<void> {
  const unbondedTokens = await getUnbondedTokens();

  if (unbondedTokens.length === 0) {
    return;
  }

  // Process in batches of 50
  const batches: string[][] = [];
  for (let i = 0; i < unbondedTokens.length; i += BATCH_SIZE) {
    batches.push(unbondedTokens.slice(i, i + BATCH_SIZE));
  }

  let totalBondedFound = 0;

  for (const batch of batches) {
    const { bondingStatusMap, poolInfoMap } = await fetchBondingStatusBatch(batch);

    // Collect bonded and unbonded tokens separately
    const bondedTokens: string[] = [];
    const stillUnbondedTokens: string[] = [];

    for (const mint of batch) {
      const isBonded = bondingStatusMap.get(mint) || false;
      if (isBonded) {
        bondedTokens.push(mint);
      } else {
        stillUnbondedTokens.push(mint);
      }
    }

    // Update database for bonded tokens with pool information
    if (bondedTokens.length > 0) {
      await updateBondingStatusWithPoolInfo(bondedTokens, poolInfoMap);
      totalBondedFound += bondedTokens.length;
    }

    // Add a small delay between batches to avoid rate limiting
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

/**
 * Handle migrate event - update bonding status when migration is detected
 */
export async function handleMigrateEvent(
  mintAddress: string,
  poolInfo?: { pool: string; base_mint: string; quote_mint: string }
): Promise<void> {
  try {
    // Update bonding status to true and pool information if provided
    if (poolInfo) {
      await pool.query(
        `UPDATE tbl_soltrack_created_tokens 
         SET bonded = true,
             pool_address = $2,
             base_mint = $3,
             quote_mint = $4,
             updated_at = NOW()
         WHERE mint = $1`,
        [mintAddress, poolInfo.pool, poolInfo.base_mint, poolInfo.quote_mint]
      );
      // Store pool -> mint mapping for buy/sell events
      setPoolToMintMapping(poolInfo.pool, poolInfo.base_mint);
    } else {
      // Update only bonding status if pool info not provided
      await updateBondingStatus([mintAddress], true);
    }
  } catch (error) {
    console.error(`[BondingTracker] Error handling migrate event for ${mintAddress}:`, error);
  }
}

/**
 * Initialize the bonding tracker
 * Fetches bonding status for all unbonded tokens on startup
 */
export async function initializeBondingTracker(): Promise<void> {
  if (isInitialized) {
    return;
  }

  // Fetch bonding status for all unbonded tokens
  // Run in background so it doesn't block stream start
  fetchBondingStatusForAllTokens().catch((error) => {
    console.error('[BondingTracker] Error during initial bonding status fetch:', error);
  });

  isInitialized = true;
}

/**
 * Update bonding status for all tokens from a specific creator wallet
 * This is useful when stats are requested for a blacklisted wallet
 */
export async function updateBondingStatusForCreator(creatorAddress: string): Promise<void> {
  try {
    // Get all tokens (bonded and unbonded) from this creator
    const result = await pool.query(
      `SELECT mint 
       FROM tbl_soltrack_created_tokens
       WHERE creator = $1`,
      [creatorAddress]
    );

    const tokenMints = result.rows.map((row) => row.mint);
    
    if (tokenMints.length === 0) {
      return;
    }

    // Process in batches of 50
    const batches: string[][] = [];
    for (let i = 0; i < tokenMints.length; i += BATCH_SIZE) {
      batches.push(tokenMints.slice(i, i + BATCH_SIZE));
    }

    let totalBondedFound = 0;

    for (const batch of batches) {
      const { bondingStatusMap, poolInfoMap } = await fetchBondingStatusBatch(batch);

      // Collect bonded and unbonded tokens separately
      const bondedTokens: string[] = [];
      const unbondedTokens: string[] = [];

      for (const mint of batch) {
        const isBonded = bondingStatusMap.get(mint) || false;
        if (isBonded) {
          bondedTokens.push(mint);
        } else {
          unbondedTokens.push(mint);
        }
      }

      // Update database for both bonded and unbonded tokens
      if (bondedTokens.length > 0) {
        await updateBondingStatusWithPoolInfo(bondedTokens, poolInfoMap);
        totalBondedFound += bondedTokens.length;
      }
      
      if (unbondedTokens.length > 0) {
        await updateBondingStatus(unbondedTokens, false);
      }

      // Add a small delay between batches to avoid rate limiting
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

  } catch (error) {
    console.error(`[BondingTracker] Error updating bonding status for creator ${creatorAddress}:`, error);
    throw error;
  }
}

/**
 * Cleanup function (for consistency with other trackers)
 * Finalizes bonding status updates for any remaining tokens
 */
export async function cleanupBondingTracker(): Promise<void> {
  // Finalize bonding status for any unbonded tokens that might need checking
  // This ensures we have the latest bonding status before stopping
  try {
    const unbondedTokens = await getUnbondedTokens();
    
    if (unbondedTokens.length > 0) {
      
      // Process in batches of 50
      const batches: string[][] = [];
      for (let i = 0; i < unbondedTokens.length; i += BATCH_SIZE) {
        batches.push(unbondedTokens.slice(i, i + BATCH_SIZE));
      }

      let totalBondedFound = 0;

      for (const batch of batches) {
        const { bondingStatusMap, poolInfoMap } = await fetchBondingStatusBatch(batch);

        // Collect bonded tokens
        const bondedTokens: string[] = [];
        for (const mint of batch) {
          const isBonded = bondingStatusMap.get(mint) || false;
          if (isBonded) {
            bondedTokens.push(mint);
          }
        }

        // Update database for bonded tokens
        if (bondedTokens.length > 0) {
          await updateBondingStatusWithPoolInfo(bondedTokens, poolInfoMap);
          totalBondedFound += bondedTokens.length;
        }

        // Add a small delay between batches to avoid rate limiting
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

    }
  } catch (error) {
    console.error('[BondingTracker] Error during cleanup bonding status fetch:', error);
  }
  
  isInitialized = false;
}

