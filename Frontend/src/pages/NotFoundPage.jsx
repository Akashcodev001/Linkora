import { Link } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg-surface p-4 text-center">
      <div>
        <p className="text-sm uppercase tracking-wide text-text-muted">404</p>
        <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
        <Link to={ROUTES.DASHBOARD} className="mt-4 inline-block text-brand hover:underline">
          Return to dashboard
        </Link>
      </div>
    </main>
  )
}

export default NotFoundPage
