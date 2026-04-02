import { useSessionManager } from '@/hooks/useSessionManager'

export function SessionBootstrap({ children }) {
  // Initialize session on mount - restores user from token if available
  useSessionManager()

  return children
}

export default SessionBootstrap
