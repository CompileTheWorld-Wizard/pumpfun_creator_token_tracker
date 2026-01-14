// Trade Tracking API Service
// Connects to trade_tracking_server (port 5007)
// Uses direct server URL in production, or /trade-api proxy in development

// Get the base URL - use env var if set, otherwise construct from current location
const getTradeApiBase = () => {
  if (import.meta.env.VITE_TRADE_SERVER_URL) {
    return import.meta.env.VITE_TRADE_SERVER_URL;
  }
  // In development, use proxy
  if (import.meta.env.DEV) {
    return '/trade-api';
  }
  // In production, use same host with port 5007
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:5007/api`;
};

const API_BASE = getTradeApiBase();

/**
 * Fetch tracking status
 */
export async function fetchTrackingStatus() {
  try {
    const response = await fetch(`${API_BASE}/status`, {
      credentials: 'include'
    })
    
    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Unauthorized' }
      }
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      return { success: false, error: errorData.error || 'Failed to fetch status' }
    }
    
    const data = await response.json()
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' }
  }
}

/**
 * Set tracking addresses
 */
export async function setAddresses(addresses: string[]) {
  try {
    const response = await fetch(`${API_BASE}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ addresses })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error)
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Start tracking
 */
export async function startTracking() {
  try {
    const response = await fetch(`${API_BASE}/start`, {
      method: 'POST',
      credentials: 'include'
    })

    const result = await response.json()
    return { success: response.ok, data: result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Stop tracking
 */
export async function stopTracking() {
  try {
    const response = await fetch(`${API_BASE}/stop`, {
      method: 'POST',
      credentials: 'include'
    })

    const result = await response.json()
    return { success: response.ok, data: result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Fetch transactions with pagination
 */
export async function fetchTransactions(page: number = 1, pageSize: number = 50, selectedWallets: string[] = []) {
  try {
    const offset = (page - 1) * pageSize
    let queryString = `limit=${pageSize}&offset=${offset}`
    
    if (selectedWallets && selectedWallets.length > 0) {
      queryString += `&wallets=${selectedWallets.join(',')}`
    }
    
    const response = await fetch(`${API_BASE}/transactions?${queryString}`, {
      credentials: 'include'
    })
    const data = await response.json()
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Fetch all unique wallets
 */
export async function fetchAllWallets() {
  try {
    const response = await fetch(`${API_BASE}/wallets`, {
      credentials: 'include'
    })
    const data = await response.json()
    return { success: data.success, wallets: data.wallets || [] }
  } catch (error: any) {
    return { success: false, error: error.message, wallets: [] }
  }
}

/**
 * Analyze wallet
 */
export async function analyzeWallet(walletAddress: string, page: number = 1, pageSize: number = 50) {
  try {
    const queryString = `page=${page}&pageSize=${pageSize}`
    const response = await fetch(`${API_BASE}/analyze/${encodeURIComponent(walletAddress)}?${queryString}`, {
      credentials: 'include'
    })
    
    if (!response.ok) {
      throw new Error('Failed to analyze wallet')
    }
    
    const data = await response.json()
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Fetch skip tokens
 */
export async function fetchSkipTokens() {
  try {
    const response = await fetch(`${API_BASE}/skip-tokens`, {
      credentials: 'include'
    })
    const data = await response.json()
    return { success: data.success, data: data.skipTokens || [] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Add skip token
 */
export async function addSkipToken(mintAddress: string, symbol?: string) {
  try {
    const response = await fetch(`${API_BASE}/skip-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        mint_address: mintAddress,
        symbol: symbol || null,
        description: null
      })
    })
    
    const data = await response.json()
    return { success: data.success, data, error: data.error }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Remove skip token
 */
export async function removeSkipToken(mintAddress: string) {
  try {
    const response = await fetch(`${API_BASE}/skip-tokens/${encodeURIComponent(mintAddress)}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    
    const data = await response.json()
    return { success: data.success, error: data.error }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Delete wallet and all transactions
 */
export async function deleteWalletAndTransactions(walletAddress: string) {
  try {
    const response = await fetch(`${API_BASE}/wallets/${encodeURIComponent(walletAddress)}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    
    const data = await response.json()
    return { 
      success: data.success, 
      error: data.error,
      transactionsDeleted: data.transactionsDeleted,
      walletsDeleted: data.walletsDeleted
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Fetch dashboard statistics
 */
export async function fetchDashboardStatistics(walletAddress: string) {
  try {
    const response = await fetch(`${API_BASE}/dashboard-statistics/${encodeURIComponent(walletAddress)}`, {
      method: 'POST',
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch dashboard statistics')
    }

    const data = await response.json()
    return { 
      success: true, 
      statistics: data.statistics || {}
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Fetch dashboard data with filters
 */
export async function fetchDashboardData(
  walletAddress: string, 
  page: number = 1, 
  limit: number = 50, 
  filters: any[] = []
) {
  try {
    const response = await fetch(`${API_BASE}/dashboard-data/${encodeURIComponent(walletAddress)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        page,
        limit,
        filters
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch dashboard data')
    }

    const data = await response.json()
    return { 
      success: true, 
      data: data.data || [], 
      totalBuys: data.totalBuys || 0, 
      totalSells: data.totalSells || 0, 
      averageOpenPosition: data.averageOpenPosition || 0,
      totalCount: data.totalCount || 0,
      page: data.page || page,
      limit: data.limit || limit,
      totalPages: data.totalPages || 1
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Fetch wallet trading activity
 */
export async function fetchWalletActivity(walletAddress: string, interval: string = 'day') {
  try {
    const response = await fetch(`${API_BASE}/wallet-activity/${encodeURIComponent(walletAddress)}?interval=${encodeURIComponent(interval)}`, {
      method: 'GET',
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch wallet activity')
    }

    const data = await response.json()
    return { success: true, data: data.data || [], interval: data.interval || interval }
  } catch (error: any) {
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * Fetch dashboard filter presets
 */
export async function fetchDashboardFilterPresets() {
  try {
    const response = await fetch(`${API_BASE}/dashboard-filter-presets`, {
      method: 'GET',
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch filter presets')
    }

    const data = await response.json()
    return { success: true, presets: data.presets || [] }
  } catch (error: any) {
    return { success: false, error: error.message, presets: [] }
  }
}

/**
 * Fetch dashboard filter preset by name
 */
export async function fetchDashboardFilterPreset(name: string) {
  try {
    const response = await fetch(`${API_BASE}/dashboard-filter-presets/${encodeURIComponent(name)}`, {
      method: 'GET',
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch filter preset')
    }

    const data = await response.json()
    return { success: true, preset: data.preset }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Save dashboard filter preset
 */
export async function saveDashboardFilterPreset(name: string, filters: any) {
  try {
    const response = await fetch(`${API_BASE}/dashboard-filter-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, filters })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to save filter preset')
    }

    const data = await response.json()
    return { success: true, message: data.message }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Delete dashboard filter preset
 */
export async function deleteDashboardFilterPreset(name: string) {
  try {
    const response = await fetch(`${API_BASE}/dashboard-filter-presets/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete filter preset')
    }

    const data = await response.json()
    return { success: true, message: data.message }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Fetch SOL price
 */
export async function fetchSolPrice() {
  try {
    const response = await fetch(`${API_BASE}/sol-price`, {
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch SOL price')
    }

    const data = await response.json()
    return { success: true, price: data.price }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Fetch creator tokens
 */
export async function fetchCreatorTokens(walletAddress: string) {
  try {
    const response = await fetch(`${API_BASE}/creator-tokens/${encodeURIComponent(walletAddress)}`, {
      method: 'GET',
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch creator tokens')
    }

    const data = await response.json()
    return { 
      success: true, 
      walletAddress: data.walletAddress,
      tokenCount: data.tokenCount || 0,
      tokens: data.tokens || []
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Fetch ATH market cap
 */
export async function fetchATHMarketCap(tokenAddresses: string[], sinceDate?: string) {
  try {
    const response = await fetch(`${API_BASE}/tokens/ath-mcap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        tokens: tokenAddresses,
        sinceDate: sinceDate
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch ATH market cap')
    }

    const data = await response.json()
    return {
      success: true,
      results: data.results || {},
      count: data.count || 0
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Calculate what-if PNL
 */
export async function calculateWhatIf(
  walletAddress: string, 
  firstSellTimeAdjustment?: number, 
  setAllSellsTo?: number
) {
  try {
    const body: any = {}
    if (firstSellTimeAdjustment !== undefined && firstSellTimeAdjustment !== null) {
      body.firstSellTimeAdjustment = firstSellTimeAdjustment
    }
    if (setAllSellsTo !== undefined && setAllSellsTo !== null) {
      body.setAllSellsTo = setAllSellsTo
    }

    const response = await fetch(`${API_BASE}/what-if/${encodeURIComponent(walletAddress)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to calculate what-if PNL')
    }

    const data = await response.json()
    return { success: true, whatIfData: data.whatIfData || [] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Download token Excel
 */
export async function downloadTokenExcel(walletAddress: string, tokenAddress: string) {
  try {
    const response = await fetch(`${API_BASE}/export-token-excel/${encodeURIComponent(walletAddress)}/${encodeURIComponent(tokenAddress)}`, {
      method: 'GET',
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to download Excel file')
    }

    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = `Token_${walletAddress.substring(0, 8)}_${Date.now()}.xlsx`
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/)
      if (filenameMatch) {
        filename = filenameMatch[1]
      }
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Download all tokens Excel
 */
export async function downloadAllTokensExcel(walletAddress: string) {
  try {
    const response = await fetch(`${API_BASE}/export-all-tokens-excel/${encodeURIComponent(walletAddress)}`, {
      method: 'GET',
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to download Excel file')
    }

    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = `AllTokens_${walletAddress.substring(0, 8)}_${Date.now()}.xlsx`
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/)
      if (filenameMatch) {
        filename = filenameMatch[1]
      }
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
