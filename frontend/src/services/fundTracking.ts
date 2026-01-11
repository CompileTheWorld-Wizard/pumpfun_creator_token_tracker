// Fund Tracking API Service
// Connects to fund_tracking_server (port 5006)
// Uses /fund-api proxy in development, or direct URL in production

const API_BASE = import.meta.env.VITE_FUND_SERVER_URL || '/fund-api'

export interface SolTransfer {
  id: number;
  signature: string;
  sender: string;
  receiver: string;
  block_number: number;
  amount: number;
  created_at: string;
}

export interface TrackingStatus {
  isTracking: boolean;
  minSolAmount: number;
}

/**
 * Fetch tracking status
 */
export async function fetchTrackingStatus(): Promise<{ success: boolean; data?: TrackingStatus; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/tracking/status`, {
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
 * Start tracking
 */
export async function startTracking(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/tracking/start`, {
      method: 'POST',
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to start tracking' }
    }

    const data = await response.json()
    return { success: data.success || false, error: data.error }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Stop tracking
 */
export async function stopTracking(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/tracking/stop`, {
      method: 'POST',
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to stop tracking' }
    }

    const data = await response.json()
    return { success: data.success || false, error: data.error }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Update minimum SOL amount
 */
export async function updateMinSolAmount(amount: number): Promise<{ success: boolean; minSolAmount?: number; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/tracking/min-sol`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ amount })
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to update minimum SOL amount' }
    }

    const data = await response.json()
    return { success: data.success || false, minSolAmount: data.minSolAmount, error: data.error }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Fetch SOL transfers with pagination
 */
export async function fetchSolTransfers(limit: number = 100, offset: number = 0): Promise<{ success: boolean; transfers?: SolTransfer[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/sol-transfers?limit=${limit}&offset=${offset}`, {
      credentials: 'include'
    })
    
    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to fetch SOL transfers' }
    }
    
    const data = await response.json()
    return { success: true, transfers: data.transfers || [] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Fetch SOL transfers by sender
 */
export async function fetchSolTransfersBySender(sender: string, limit: number = 100): Promise<{ success: boolean; transfers?: SolTransfer[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/sol-transfers/sender/${encodeURIComponent(sender)}?limit=${limit}`, {
      credentials: 'include'
    })
    
    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to fetch SOL transfers' }
    }
    
    const data = await response.json()
    return { success: true, transfers: data.transfers || [] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Fetch SOL transfers by receiver
 */
export async function fetchSolTransfersByReceiver(receiver: string, limit: number = 100): Promise<{ success: boolean; transfers?: SolTransfer[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/sol-transfers/receiver/${encodeURIComponent(receiver)}?limit=${limit}`, {
      credentials: 'include'
    })
    
    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to fetch SOL transfers' }
    }
    
    const data = await response.json()
    return { success: true, transfers: data.transfers || [] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
