const API_BASE = '/api/auth'

export const login = async (password: string): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ password }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    return { success: false, error: 'Network error' }
  }
}

export const logout = async (): Promise<void> => {
  try {
    await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch (error) {
    console.error('Logout error:', error)
  }
}

export const checkAuth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/check`, {
      credentials: 'include',
    })
    const data = await response.json()
    return data.authenticated === true
  } catch (error) {
    return false
  }
}

export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const response = await fetch(`${API_BASE}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    return { success: false, error: 'Network error' }
  }
}

