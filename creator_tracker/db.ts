import { createClient, ClickHouseClient } from '@clickhouse/client';
import dotenv from 'dotenv';

dotenv.config();

// Create ClickHouse client
export const clickhouse: ClickHouseClient = createClient({
  host: process.env.CLICKHOUSE_HOST || process.env.DB_HOST || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || process.env.DB_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.CLICKHOUSE_DB || process.env.DB_NAME || 'default',
});

// Helper function to convert PostgreSQL-style parameters to ClickHouse format
function convertQueryToClickHouse(text: string, params?: any[]): { query: string; queryParams?: Record<string, any> } {
  if (!params || params.length === 0) {
    return { query: text };
  }

  // Replace PostgreSQL $1, $2, etc. with ClickHouse {param1:Type} format
  let query = text;
  const queryParams: Record<string, any> = {};
  
  params.forEach((param, index) => {
    const paramName = `param${index + 1}`;
    let type = 'String';
    
    // Determine ClickHouse type based on value
    if (param === null || param === undefined) {
      type = 'Nullable(String)';
    } else if (typeof param === 'number') {
      if (Number.isInteger(param)) {
        type = 'Int64';
      } else {
        type = 'Float64';
      }
    } else if (typeof param === 'boolean') {
      type = 'UInt8';
    } else if (param instanceof Date) {
      type = 'DateTime';
    }
    
    queryParams[paramName] = param;
    // Replace $1, $2, etc. with {param1:Type}
    query = query.replace(new RegExp(`\\$${index + 1}\\b`, 'g'), `{${paramName}:${type}}`);
  });

  return { query, queryParams };
}

// PostgreSQL-compatible query interface for easier migration
// This wraps ClickHouse queries to match the pool.query() interface
export const pool = {
  query: async (text: string, params?: any[]): Promise<{ rows: any[] }> => {
    try {
      const { query, queryParams } = convertQueryToClickHouse(text, params);
      
      const result = await clickhouse.query({
        query,
        query_params: queryParams,
        format: 'JSONEachRow',
      });

      const data = await result.json();
      return { rows: Array.isArray(data) ? data : [] };
    } catch (error: any) {
      console.error('ClickHouse query error:', error);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    }
  },
  
  // For compatibility with PostgreSQL connection methods
  connect: async () => {
    // ClickHouse doesn't need explicit connection
    return {
      query: pool.query,
      release: () => {},
    };
  },
};

// Helper for batch inserts (ClickHouse is optimized for batch inserts)
export async function insertBatch(table: string, data: any[]): Promise<void> {
  if (data.length === 0) return;
  
  try {
    await clickhouse.insert({
      table,
      values: data,
      format: 'JSONEachRow',
    });
  } catch (error: any) {
    console.error(`ClickHouse batch insert error for table ${table}:`, error);
    throw error;
  }
}

// Test connection
export async function testConnection(): Promise<void> {
  try {
    await clickhouse.ping();
    console.log('✅ ClickHouse connection successful');
  } catch (error) {
    console.error('❌ ClickHouse connection failed:', error);
    throw error;
  }
}
