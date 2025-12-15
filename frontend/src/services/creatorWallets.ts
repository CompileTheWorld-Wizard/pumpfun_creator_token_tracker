const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface CreatorWallet {
  address: string;
  totalTokens: number;
  bondedTokens: number;
  winRate: number; // % bonded (win rate)
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreatorWalletsResponse {
  wallets: CreatorWallet[];
  pagination: PaginationInfo;
}

export async function getCreatorWalletsAnalytics(
  page: number = 1,
  limit: number = 20,
  viewAll: boolean = false
): Promise<CreatorWalletsResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  
  if (viewAll) {
    params.append('viewAll', 'true');
  }
  
  const response = await fetch(`${API_BASE_URL}/tokens/creators/analytics?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch creator wallets analytics');
  }

  const data = await response.json();
  return {
    wallets: data.wallets || [],
    pagination: data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
  };
}

