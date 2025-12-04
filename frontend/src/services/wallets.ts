const API_BASE = '/api/wallets'

export const validateWallet = async (address: string): Promise<{ valid: boolean; error?: string }> => {
  try {
    const response = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ address }),
    })

    const data = await response.json()
    
    if (!response.ok) {
      return { valid: false, error: data.error || 'Validation failed' }
    }
    
    return data
  } catch (error) {
    return { valid: false, error: 'Network error. Please try again.' }
  }
}

export const getCreatorWallets = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${API_BASE}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch creator wallets')
    }

    const data = await response.json()
    return data.wallets || []
  } catch (error) {
    console.error('Error fetching creator wallets:', error)
    return []
  }
}

export const addCreatorWallet = async (address: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(`${API_BASE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ address }),
    })

    const data = await response.json()
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to add wallet' }
    }
    
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Network error. Please try again.' }
  }
}

export const removeCreatorWallet = async (address: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(address)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    const data = await response.json()
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to remove wallet' }
    }
    
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Network error. Please try again.' }
  }
}

