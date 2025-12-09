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
          where: {
            Trade: {
              Currency: {MintAddress: {in: $tokens}},
              Side: {
                Currency: {
                  MintAddress: {in: ["11111111111111111111111111111111", "So11111111111111111111111111111111111111112"]}
                }
              }
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
    const requestBody = {
      query,
      variables: {
        tokens: addresses,
        since: sinceTime,
      },
    };

    console.log(`[Bitquery] Requesting ATH for ${addresses.length} tokens:`);
    console.log(`[Bitquery] Token addresses:`, addresses);
    console.log(`[Bitquery] Since time: ${sinceTime}`);
    console.log(`[Bitquery] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(BITQUERY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`[Bitquery] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Bitquery] API error: ${response.status} - ${errorText}`);
      return [];
    }

    const result: any = await response.json();
    
    // Log full response for debugging
    console.log(`[Bitquery] Full API response:`, JSON.stringify(result, null, 2));
    
    if (result.errors) {
      console.error('[Bitquery] GraphQL errors:', JSON.stringify(result.errors, null, 2));
      return [];
    }

    const trades = result.data?.Solana?.DEXTradeByTokens || [];
    console.log(`[Bitquery] Raw trades array length: ${trades.length}`);
    console.log(`[Bitquery] Raw trades data:`, JSON.stringify(trades, null, 2));
    
    const athDataList: TokenAthData[] = trades.map((trade: any, index: number) => {
      const mintAddress = trade.Trade?.Currency?.MintAddress || '';
      const name = trade.Trade?.Currency?.Name || '';
      const symbol = trade.Trade?.Currency?.Symbol || '';
      const max = trade.max;
      const athMarketcap = trade.ATH_Marketcap;
      const priceInUsd = trade.Trade?.PriceInUSD;
      
      console.log(`[Bitquery] Trade ${index}:`, {
        mintAddress,
        name,
        symbol,
        max,
        athMarketcap,
        priceInUsd,
        rawTrade: JSON.stringify(trade, null, 2)
      });
      
      return {
        mintAddress,
        name,
        symbol,
        athPriceUsd: parseFloat(max) || 0,
        athMarketCapUsd: parseFloat(athMarketcap) || 0,
      };
    }).filter((data: TokenAthData) => data.mintAddress);

    console.log(`[Bitquery] Processed ATH data for ${athDataList.length} tokens:`);
    athDataList.forEach((data, index) => {
      console.log(`[Bitquery] Token ${index + 1}: ${data.mintAddress} (${data.symbol}) - ATH: $${data.athMarketCapUsd}, Price: $${data.athPriceUsd}`);
    });
    
    return athDataList;
  } catch (error) {
    console.error('[Bitquery] Error fetching ATH data:', error);
    if (error instanceof Error) {
      console.error('[Bitquery] Error stack:', error.stack);
    }
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

