import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLazyGetMeQuery } from '@/app/api/authApi'
import { logout, setCredentials, setInitialized } from '@/features/auth/authSlice'

let bootstrapPromise = null
let bootstrapCompletedAt = 0
const BOOTSTRAP_COOLDOWN_MS = 30 * 1000

/**
 * useSessionManager - Handles automatic session refresh on app mount
 *
 * Features:
 * - Automatically restores user session from token on mount
 * - Prevents multiple concurrent refresh requests
 * - Handles token expiration gracefully
 * - Maintains session across page refreshes
 */
export function useSessionManager() {
  const dispatch = useDispatch()
  const [triggerGetMe] = useLazyGetMeQuery()
  const hasInitialized = useRef(false)
  const { isInitialized } = useSelector((state) => state.auth)

  useEffect(() => {
    // Only run once on mount
    if (hasInitialized.current) {
      return
    }

    hasInitialized.current = true

    const now = Date.now()
    const shouldSkip = bootstrapCompletedAt && now - bootstrapCompletedAt < BOOTSTRAP_COOLDOWN_MS
    if (shouldSkip) {
      if (!isInitialized) {
        dispatch(setInitialized(true))
      }
      return
    }

    const initializeSession = async () => {
      try {
        try {
          const result = await triggerGetMe().unwrap()
          const user = result?.user || result?.data?.user

          if (user) {
            dispatch(
              setCredentials({
                user,
                isAuthenticated: true,
              })
            )
          } else {
            dispatch(logout())
          }
        } catch (error) {
          const status = Number(error?.status || 0)
          // Only clear auth state when server confirms auth failure.
          if (status === 401 || status === 403) {
            dispatch(logout())
          }
        }
      } finally {
        bootstrapCompletedAt = Date.now()
        // Always mark as initialized, whether login succeeded or not
        if (!isInitialized) {
          dispatch(setInitialized(true))
        }
      }
    }

    if (!bootstrapPromise) {
      bootstrapPromise = initializeSession().finally(() => {
        bootstrapPromise = null
      })
    }

    return () => {}
  }, [dispatch, isInitialized, triggerGetMe])

  return { isInitialized }
}

export default useSessionManager
