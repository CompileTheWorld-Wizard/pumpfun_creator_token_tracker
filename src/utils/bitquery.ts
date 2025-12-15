/**
 * Bitquery API Utility
 * Fetch ATH market cap data for tokens
 */

import dotenv from 'dotenv';

dotenv.config();

const BITQUERY_ENDPOINT = 'https://streaming.bitquery.io/graphql';

export interface TokenAthData {
  mintAddress: string;
  name: string;
  symbol: string;
  athPriceUsd: number;
  athMarketCapUsd: number;
}

/**
 * Fetch ATH market cap for multiple tokens from Bitquery
 * @param tokenAddresses Array of token mint addresses (max 100)
 * @param sinceTime ISO timestamp string for earliest block time
 */
export async function fetchAthMarketCap(
  tokenAddresses: string[],
  sinceTime: string = '2024-01-01T00:00:00Z'
): Promise<TokenAthData[]> {
  const apiKey = process.env.BITQUERY_API_KEY;
  
  if (!apiKey) {
    console.error('[Bitquery] BITQUERY_API_KEY not configured');
    return [];
  }

  if (tokenAddresses.length === 0) {
    return [];
  }

  // Limit to 100 tokens per request
  const addresses = tokenAddresses.slice(0, 100);
  
  const query = `
    query GetAthMarketCap($tokens: [String!]!, $since: DateTime!) {
      Solana(dataset: combined) {
        DEXTradeByTokens(
          limitBy: {by: Trade_Currency_MintAddress, count: 1}
          where: {
            Trade: {
              Currency: {MintAddress: {in: $tokens}}
              PriceInUSD:{gt:0}
            },
            Block: {Time: {since: $since}}
          }
        ) {
          Trade {
            Currency {
              MintAddress
              Name
              Symbol
            }
            PriceInUSD(maximum: Trade_PriceInUSD)
            Side{
              Currency{
                Name
                Symbol
                MintAddress
              }
            }
          }
          max: quantile(of: Trade_PriceInUSD, level: 0.98)
          ATH_Marketcap: calculate(expression: "$max * 1000000000")
        }
      }
    }
  `;

  try {
    const response = await fetch(BITQUERY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        variables: {
          tokens: addresses,
          since: sinceTime,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Bitquery] API error: ${response.status} - ${errorText}`);
      return [];
    }

    const result: any = await response.json();
    
    if (result.errors) {
      console.error('[Bitquery] GraphQL errors:', JSON.stringify(result.errors, null, 2));
      return [];
    }

    // Log full response structure for debugging (first time only)
    if (!result.data) {
      console.error('[Bitquery] No data in response:', JSON.stringify(result, null, 2));
      return [];
    }

    const trades = result.data?.Solana?.DEXTradeByTokens || [];
    
    console.log(`[Bitquery] Received ${trades.length} trades for ${addresses.length} tokens`);
    
    // Log sample trade structure for debugging
    if (trades.length > 0) {
      console.log('[Bitquery] Sample trade structure:', JSON.stringify(trades[0], null, 2));
    } else {
      console.log(`[Bitquery] No trades found. Full response data:`, JSON.stringify(result.data, null, 2));
    }
    
    // Map trades to TokenAthData and group by mintAddress to get maximum values
    const tokenMap = new Map<string, TokenAthData>();
    
    trades.forEach((trade: any) => {
      const mintAddress = trade.Trade?.Currency?.MintAddress || '';
      const maxPrice = trade.max;
      const athMarketcap = trade.ATH_Marketcap;
      
      // Log for debugging
      if (!mintAddress || !maxPrice || !athMarketcap) {
        console.log(`[Bitquery] Missing data for trade:`, {
          mintAddress,
          maxPrice,
          athMarketcap,
          trade: JSON.stringify(trade).substring(0, 200)
        });
      }
      
      if (!mintAddress) return;
      
      const athPriceUsd = maxPrice ? parseFloat(maxPrice) : 0;
      const athMarketCapUsd = athMarketcap ? parseFloat(athMarketcap) : 0;
      
      const existing = tokenMap.get(mintAddress);
      
      if (!existing) {
        // First entry for this token
        tokenMap.set(mintAddress, {
          mintAddress,
          name: trade.Trade?.Currency?.Name || '',
          symbol: trade.Trade?.Currency?.Symbol || '',
          athPriceUsd,
          athMarketCapUsd,
        });
      } else {
        // Update with maximum values
        tokenMap.set(mintAddress, {
          ...existing,
          athPriceUsd: Math.max(existing.athPriceUsd, athPriceUsd),
          athMarketCapUsd: Math.max(existing.athMarketCapUsd, athMarketCapUsd),
        });
      }
    });
    
    const athDataList: TokenAthData[] = Array.from(tokenMap.values());

    console.log(`[Bitquery] Processed ${athDataList.length} tokens with ATH data`);
    if (athDataList.length > 0) {
      console.log(`[Bitquery] Sample ATH data:`, athDataList[0]);
    }
    
    return athDataList;
  } catch (error) {
    console.error('[Bitquery] Error fetching ATH data:', error);
    return [];
  }
}

/**
 * Fetch ATH for tokens in batches of 100
 */
export async function fetchAthMarketCapBatched(
  tokenAddresses: string[],
  sinceTime: string = '2024-01-01T00:00:00Z',
  batchDelayMs: number = 1000
): Promise<TokenAthData[]> {
  const results: TokenAthData[] = [];
  
  for (let i = 0; i < tokenAddresses.length; i += 100) {
    const batch = tokenAddresses.slice(i, i + 100);
    const batchResults = await fetchAthMarketCap(batch, sinceTime);
    results.push(...batchResults);
    
    // Add delay between batches to avoid rate limiting
    if (i + 100 < tokenAddresses.length) {
      await new Promise(resolve => setTimeout(resolve, batchDelayMs));
    }
  }
  
  return results;
}

