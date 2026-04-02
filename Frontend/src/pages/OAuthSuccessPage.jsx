import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLazyGetMeQuery } from '@/app/api/authApi'
import { ROUTES } from '@/constants/routes'
import toast from 'react-hot-toast'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Mail, CheckCircle2 } from 'lucide-react'

export function OAuthSuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [triggerGetMe] = useLazyGetMeQuery()
  const [isVerificationSent, setIsVerificationSent] = useState(false)

  useEffect(() => {
    let active = true

    const hydrate = async () => {
      try {
        const result = await triggerGetMe().unwrap()
        
        if (!active) return

        // Check if user just created account via OAuth
        const isNewUser = searchParams.get('created') === '1'
        const isVerified = result.verified === true || searchParams.get('verified') === '1'

        if (isNewUser && !isVerified) {
          // User created via OAuth but not verified
          setIsVerificationSent(true)
          toast.success('A verification email has been sent. Please check your inbox!', {
            duration: 5000,
          })
          return
        }

        // User is verified or existing user, proceed to dashboard
        navigate(ROUTES.DASHBOARD, { replace: true })
      } catch (error) {
        if (active) {
          const message = error?.data?.message || 'Could not finish social sign-in. Please try again.'
          toast.error(message)
          navigate(ROUTES.LOGIN, {
            replace: true,
            state: { oauthError: message },
          })
        }
      }
    }

    hydrate()

    return () => {
      active = false
    }
  }, [navigate, triggerGetMe, searchParams])

  if (isVerificationSent) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg-base p-4">
        <Card className="w-full max-w-md" padding="comfortable">
          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-state-success/10 p-3 mb-4">
              <Mail size={32} className="text-state-success" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary">Verify your email</h2>
            <p className="mt-2 text-sm text-text-secondary">
              We've sent a verification link to your email. Check your inbox and click the link to get started.
            </p>
            <div className="mt-6 flex items-center gap-2 rounded-default border border-state-success/30 bg-state-success/5 px-4 py-3 text-sm text-state-success">
              <CheckCircle2 size={18} className="flex-shrink-0" />
              Email verification required for account activation
            </div>
            <p className="mt-4 text-xs text-text-muted">
              Once verified, you can sign in and start using Linkora.
            </p>
            <Button
              variant="secondary"
              className="mt-6 w-full"
              onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
            >
              Go back to login
            </Button>
          </div>
        </Card>
      </main>
    )
  }

  return (
    <main className="grid min-h-screen place-items-center bg-bg-base p-6">
      <div className="rounded-lg border border-border bg-bg-surface px-6 py-5 shadow-card">
        <p className="text-sm text-text-secondary">Finalizing sign-in...</p>
      </div>
    </main>
  )
}

export default OAuthSuccessPage
