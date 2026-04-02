import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '@/features/auth/authSlice'
import tokenManager from '@/lib/tokenManager'

/**
 * Auth state selector and auth actions wrapper.
 */
export function useAuth() {
  const dispatch = useDispatch()
  const { user, isAuthenticated, isInitialized } = useSelector((state) => state.auth)

  const signOut = useCallback(() => {
    tokenManager.clearToken()
    dispatch(logout())
  }, [dispatch])

  return {
    user,
    isAuthenticated,
    isInitialized,
    logout: signOut,
  }
}

export default useAuth
