import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/constants/routes'

export function AdminRoute({ children }) {
  const { user, isInitialized, isAuthenticated } = useAuth()
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin'

  if (!isInitialized) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg-surface">
        <p className="text-sm text-text-secondary">Checking access...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (!isAdmin) {
    return <Navigate to={ROUTES.DASHBOARD} replace state={{ denied: 'admin' }} />
  }

  return children
}

export default AdminRoute