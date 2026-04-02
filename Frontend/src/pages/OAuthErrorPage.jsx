import { Link, useLocation } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { ROUTES } from '@/constants/routes'

const providerLabels = {
  google_auth_failed: 'Google sign-in failed',
  github_auth_failed: 'GitHub sign-in failed',
  oauth_login_failed: 'Social sign-in failed',
  invalid_oauth_response: 'Invalid OAuth response',
}

export function OAuthErrorPage() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const code = params.get('error') || 'oauth_login_failed'
  const message = providerLabels[code] || providerLabels.oauth_login_failed

  return (
    <main className="grid min-h-screen place-items-center bg-bg-base p-6">
      <section className="w-full max-w-md rounded-2xl border border-state-error/30 bg-bg-surface p-6 shadow-card">
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-state-error/10 text-state-error">
          <AlertTriangle size={20} />
        </div>
        <h1 className="text-xl font-semibold text-text-primary">{message}</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Please retry with your provider or continue with email and password.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <Link
            to={ROUTES.LOGIN}
            className="inline-flex h-10 items-center justify-center rounded-default bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Back to Sign in
          </Link>
          <Link
            to={ROUTES.REGISTER}
            className="inline-flex h-10 items-center justify-center rounded-default border border-border px-4 text-sm font-medium text-text-secondary hover:bg-bg-hover"
          >
            Create Account
          </Link>
        </div>
      </section>
    </main>
  )
}

export default OAuthErrorPage
