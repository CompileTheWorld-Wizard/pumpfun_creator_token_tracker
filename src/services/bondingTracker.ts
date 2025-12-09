/**
 * Bonding Tracker Service
 * 
 * Tracks token bonding status (migration to AMM/Raydium) using Shyft GraphQL API.
 * Updates bonding status when tokens migrate from bonding curve to AMM.
 */

import dotenv from 'dotenv';
import { pool } from '../db.js';

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
 */
export async function fetchBondingStatusBatch(tokenMints: string[]): Promise<Map<string, boolean>> {
  const bondingStatusMap = new Map<string, boolean>();

  if (tokenMints.length === 0) {
    return bondingStatusMap;
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
      console.error(`[BondingTracker] API request failed with status ${response.status}`);
      return bondingStatusMap;
    }

    const result = (await response.json()) as ShyftResponse;

    if (result.errors) {
      console.error('[BondingTracker] GraphQL errors:', result.errors);
      return bondingStatusMap;
    }

    // Process pool data - if a token has a pool, it's bonded
    const pools = result.data?.pump_fun_amm_Pool || [];
    const bondedMints = new Set<string>();

    for (const pool of pools) {
      // Both base_mint and quote_mint could be our tracked tokens
      if (tokenMints.includes(pool.base_mint)) {
        bondedMints.add(pool.base_mint);
      }
      if (tokenMints.includes(pool.quote_mint)) {
        bondedMints.add(pool.quote_mint);
      }
    }

    // Set bonding status for all tokens in the batch
    for (const mint of tokenMints) {
      bondingStatusMap.set(mint, bondedMints.has(mint));
    }

    if (bondedMints.size > 0) {
      console.log(`[BondingTracker] Found ${bondedMints.size} bonded tokens in batch of ${tokenMints.length}`);
    }
  } catch (error) {
    console.error('[BondingTracker] Error fetching bonding status:', error);
  }

  return bondingStatusMap;
}

/**
 * Get all unbonded tokens from database
 * Excludes tokens created by blacklisted wallets
 */
async function getUnbondedTokens(): Promise<string[]> {
  try {
    const result = await pool.query(
      `SELECT mint 
       FROM created_tokens
       WHERE creator NOT IN (SELECT wallet_address FROM blacklist_creator)
         AND COALESCE(bonded, false) = false
       ORDER BY created_at DESC`
    );

    return result.rows.map((row) => row.mint);
  } catch (error) {
    console.error('[BondingTracker] Error fetching unbonded tokens:', error);
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
      `UPDATE created_tokens 
       SET bonded = $${mintAddresses.length + 1}, 
           updated_at = NOW()
       WHERE mint IN (${placeholders})`,
      [...mintAddresses, bonded]
    );

    console.log(
      `[BondingTracker] Updated bonding status for ${mintAddresses.length} tokens: bonded=${bonded}`
    );
  } catch (error) {
    console.error('[BondingTracker] Error updating bonding status:', error);
    throw error;
  }
}

/**
 * Fetch bonding status for all unbonded tokens in batches
 */
async function fetchBondingStatusForAllTokens(): Promise<void> {
  console.log('[BondingTracker] Fetching bonding status for all unbonded tokens...');

  const unbondedTokens = await getUnbondedTokens();
  
  if (unbondedTokens.length === 0) {
    console.log('[BondingTracker] No unbonded tokens to check');
    return;
  }

  console.log(`[BondingTracker] Found ${unbondedTokens.length} unbonded tokens to check`);

  // Process in batches of 50
  const batches: string[][] = [];
  for (let i = 0; i < unbondedTokens.length; i += BATCH_SIZE) {
    batches.push(unbondedTokens.slice(i, i + BATCH_SIZE));
  }

  let totalBondedFound = 0;

  for (const batch of batches) {
    const bondingStatusMap = await fetchBondingStatusBatch(batch);

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

    // Update database for bonded tokens
    if (bondedTokens.length > 0) {
      await updateBondingStatus(bondedTokens, true);
      totalBondedFound += bondedTokens.length;
    }

    // Add a small delay between batches to avoid rate limiting
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(
    `[BondingTracker] Completed checking ${unbondedTokens.length} tokens. Found ${totalBondedFound} bonded tokens.`
  );
}

/**
 * Handle migrate event - update bonding status when migration is detected
 */
export async function handleMigrateEvent(mintAddress: string): Promise<void> {
  try {
    // Update bonding status to true
    await updateBondingStatus([mintAddress], true);
    console.log(`[BondingTracker] Token migrated: ${mintAddress}`);
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
    console.log('[BondingTracker] Already initialized');
    return;
  }

  console.log('[BondingTracker] Initializing...');

  // Fetch bonding status for all unbonded tokens
  // Run in background so it doesn't block stream start
  fetchBondingStatusForAllTokens().catch((error) => {
    console.error('[BondingTracker] Error during initial bonding status fetch:', error);
  });

  isInitialized = true;
  console.log('[BondingTracker] Initialized');
}

/**
 * Update bonding status for all tokens from a specific creator wallet
 * This is useful when stats are requested for a blacklisted wallet
 */
export async function updateBondingStatusForCreator(creatorAddress: string): Promise<void> {
  try {
    console.log(`[BondingTracker] Updating bonding status for tokens from creator: ${creatorAddress}`);
    
    // Get all tokens (bonded and unbonded) from this creator
    const result = await pool.query(
      `SELECT mint 
       FROM created_tokens
       WHERE creator = $1`,
      [creatorAddress]
    );

    const tokenMints = result.rows.map((row) => row.mint);
    
    if (tokenMints.length === 0) {
      console.log(`[BondingTracker] No tokens found for creator: ${creatorAddress}`);
      return;
    }

    console.log(`[BondingTracker] Found ${tokenMints.length} tokens for creator ${creatorAddress}`);

    // Process in batches of 50
    const batches: string[][] = [];
    for (let i = 0; i < tokenMints.length; i += BATCH_SIZE) {
      batches.push(tokenMints.slice(i, i + BATCH_SIZE));
    }

    let totalBondedFound = 0;

    for (const batch of batches) {
      const bondingStatusMap = await fetchBondingStatusBatch(batch);

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
        await updateBondingStatus(bondedTokens, true);
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

    console.log(
      `[BondingTracker] Completed updating bonding status for creator ${creatorAddress}: ${tokenMints.length} tokens, ${totalBondedFound} bonded`
    );
  } catch (error) {
    console.error(`[BondingTracker] Error updating bonding status for creator ${creatorAddress}:`, error);
    throw error;
  }
}

/**
 * Cleanup function (for consistency with other trackers)
 */
export async function cleanupBondingTracker(): Promise<void> {
  isInitialized = false;
  console.log('[BondingTracker] Cleaned up');
}

