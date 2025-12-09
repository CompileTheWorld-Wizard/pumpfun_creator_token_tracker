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
 * @param tokenAddresses Array of token mint addresses (max 50)
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

  // Limit to 50 tokens per request
  const addresses = tokenAddresses.slice(0, 50);
  
  const query = `
    query GetAthMarketCap($tokens: [String!]!, $since: DateTime!) {
      Solana(dataset: combined) {
        DEXTradeByTokens(
          limitBy: {by: Trade_Currency_MintAddress, count: 100}
          where: {
            Trade: {
              Currency: {MintAddress: {in: $tokens}}
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
      console.error('[Bitquery] GraphQL errors:', result.errors);
      return [];
    }

    const trades = result.data?.Solana?.DEXTradeByTokens || [];
    
    const athDataList: TokenAthData[] = trades.map((trade: any) => ({
      mintAddress: trade.Trade?.Currency?.MintAddress || '',
      name: trade.Trade?.Currency?.Name || '',
      symbol: trade.Trade?.Currency?.Symbol || '',
      athPriceUsd: parseFloat(trade.max) || 0,
      athMarketCapUsd: parseFloat(trade.ATH_Marketcap) || 0,
    })).filter((data: TokenAthData) => data.mintAddress);

    
    return athDataList;
  } catch (error) {
    console.error('[Bitquery] Error fetching ATH data:', error);
    return [];
  }
}

/**
 * Fetch ATH for tokens in batches of 50
 */
export async function fetchAthMarketCapBatched(
  tokenAddresses: string[],
  sinceTime: string = '2024-01-01T00:00:00Z',
  batchDelayMs: number = 1000
): Promise<TokenAthData[]> {
  const results: TokenAthData[] = [];
  
  for (let i = 0; i < tokenAddresses.length; i += 50) {
    const batch = tokenAddresses.slice(i, i + 50);
    const batchResults = await fetchAthMarketCap(batch, sinceTime);
    results.push(...batchResults);
    
    // Add delay between batches to avoid rate limiting
    if (i + 50 < tokenAddresses.length) {
      await new Promise(resolve => setTimeout(resolve, batchDelayMs));
    }
  }
  
  return results;
}

