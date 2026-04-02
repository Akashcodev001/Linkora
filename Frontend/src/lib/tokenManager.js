const TOKEN_KEY = 'linkora_access_token'

export const tokenManager = {
  getToken() {
    // Try to get from localStorage first, fallback to memory
    try {
      return localStorage.getItem(TOKEN_KEY) || null
    } catch {
      // localStorage might not be available
      return null
    }
  },

  setToken(token) {
    if (!token) {
      this.clearToken()
      return
    }

    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // localStorage might not be available, silently fail
      console.warn('Could not save token to localStorage')
    }
  },

  clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // localStorage might not be available
      console.warn('Could not clear token from localStorage')
    }
  },
}

export const getToken = () => tokenManager.getToken()
export const setToken = (token) => tokenManager.setToken(token)
export const clearToken = () => tokenManager.clearToken()

export default tokenManager
