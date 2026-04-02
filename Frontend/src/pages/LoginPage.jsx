import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Globe, Sparkles, ShieldCheck, Mail, LockKeyhole, ArrowRight } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useLoginMutation } from '@/app/api/authApi'
import { ROUTES } from '@/constants/routes'
import toast from 'react-hot-toast'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

function buildOAuthUrl(provider) {
  return `${API_BASE}/auth/${provider}?client=web`
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [login, { isLoading }] = useLoginMutation()
  const navigate = useNavigate()
  const location = useLocation()

  const redirectTo = useMemo(() => {
    return location.state?.from || ROUTES.DASHBOARD
  }, [location.state])

  useEffect(() => {
    const prefill = location.state?.prefillEmail
    if (prefill) {
      setEmail(prefill)
      toast.success('Account created! Please sign in to continue.', {
        duration: 4000,
      })
    }

    if (location.state?.oauthError) {
      setFormError(location.state.oauthError)
      toast.error(location.state.oauthError)
    }

    if (location.state?.denied) {
      toast.error('Access restricted. Admins use a separate dashboard.', {
        duration: 4000,
      })
    }
  }, [location.state])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')

    if (!email.trim() || !password.trim()) {
      const msg = 'Email and password are required.'
      setFormError(msg)
      toast.error(msg)
      return
    }

    try {
      await login({ email: email.trim(), password }).unwrap()
      toast.success('Signed in successfully!', {
        duration: 3000,
      })
      navigate(redirectTo, { replace: true })
    } catch (error) {
      // Handle network/connection errors
      if (error?.status === undefined || error?.message?.includes('ERR_CONNECTION_REFUSED')) {
        const msg = 'Cannot connect to server. Please ensure the backend is running on http://localhost:3000'
        setFormError(msg)
        toast.error(msg)
        return
      }

      // Handle validation errors and other server errors
      const fallbackMessage = 'Could not sign in. Please check your credentials.'
      const errorMsg = error?.data?.message || error?.message || fallbackMessage
      setFormError(errorMsg)
      toast.error(errorMsg)
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-bg-base p-4">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,rgba(249,115,22,0.15),transparent_40%),radial-gradient(circle_at_90%_20%,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_50%_90%,rgba(16,185,129,0.1),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-8 -z-10 mx-auto h-48 w-[95vw] max-w-5xl rounded-full bg-brand/8 blur-3xl" />

      <section className="grid w-full max-w-6xl gap-6 md:grid-cols-[1.1fr_1fr]">
        {/* Left Panel - Info */}
        <Card className="relative hidden min-h-[580px] overflow-hidden md:flex flex-col justify-between" padding="comfortable">
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-brand/12 blur-3xl" />
          <div className="absolute -bottom-20 -left-12 h-64 w-64 rounded-full bg-state-info/12 blur-3xl" />
          
          <div className="relative z-10 space-y-8">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-3.5 py-2 text-xs font-medium text-brand">
                <Sparkles size={14} className="animate-pulse" />
                Enterprise Knowledge Workspace
              </p>
              <h1 className="mt-6 text-4xl font-bold leading-tight text-text-primary">
                Welcome back to
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-brand to-orange-400">Linkora</span>
              </h1>
              <p className="mt-4 max-w-sm text-base text-text-secondary leading-relaxed">
                Access your personalized knowledge graph, resurface forgotten insights, and monitor AI-powered analysis from a unified dashboard.
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-bg-base/40 px-4 py-3 transition-colors hover:bg-bg-hover/30">
                <ShieldCheck size={18} className="text-state-success flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Secure Authentication</p>
                  <p className="text-xs text-text-muted">OAuth + JWT token refresh</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-bg-base/40 px-4 py-3 transition-colors hover:bg-bg-hover/30">
                <Mail size={18} className="text-state-warning flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Email Verified</p>
                  <p className="text-xs text-text-muted">Admin controls protected</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 rounded-lg border border-brand/20 bg-gradient-to-br from-brand/10 to-transparent p-4">
            <p className="text-xs font-medium text-text-muted uppercase tracking-widest">Trusted by teams at:</p>
            <p className="mt-2 text-sm text-text-secondary">Forward-thinking organizations using Linkora for knowledge management.</p>
          </div>
        </Card>

        {/* Right Panel - Form */}
        <div className="space-y-4">
          <Card className="w-full" padding="comfortable">
            <div className="space-y-2 mb-6">
              <h2 className="text-2xl font-semibold text-text-primary flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15">
                  <LockKeyhole size={18} className="text-brand" />
                </div>
                Sign in
              </h2>
              <p className="text-sm text-text-muted">Continue with social login or email credentials.</p>
            </div>

            {/* Social Login Buttons */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-6">
              <a
                href={buildOAuthUrl('google')}
                className="group inline-flex h-11 items-center justify-center gap-2.5 rounded-lg border border-border bg-bg-surface font-medium text-text-primary transition-all hover:bg-bg-hover hover:border-border/60 active:scale-95"
              >
                <Globe size={17} className="group-hover:text-brand transition-colors" />
                <span>Google</span>
              </a>
              <a
                href={buildOAuthUrl('github')}
                className="group inline-flex h-11 items-center justify-center gap-2.5 rounded-lg border border-border bg-bg-surface font-medium text-text-primary transition-all hover:bg-bg-hover hover:border-border/60 active:scale-95"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] font-bold group-hover:border-brand/60 transition-colors">GH</span>
                <span>GitHub</span>
              </a>
            </div>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 text-xs font-medium uppercase text-text-muted tracking-wider bg-bg-surface">or email</span>
              </div>
            </div>

            {/* Email Form */}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-sm font-medium text-text-secondary mb-2 block">Email Address</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="bg-bg-base/60 border-border/70 focus:border-brand/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary mb-2 block">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="bg-bg-base/60 border-border/70 focus:border-brand/50"
                />
              </div>

              {formError && (
                <div className="rounded-lg border border-state-error/30 bg-state-error/5 px-4 py-3">
                  <p className="text-sm text-state-error font-medium">{formError}</p>
                </div>
              )}

              <Button 
                className="w-full h-11 font-medium group" 
                type="submit" 
                loading={isLoading}
              >
                {isLoading ? 'Signing in...' : (
                  <>
                    Sign in
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          </Card>

          {/* Signup Link */}
          <Card className="w-full bg-gradient-to-r from-bg-base to-bg-base" padding="comfortable">
            <p className="text-center text-sm text-text-secondary">
              Don't have an account?{' '}
              <Link 
                to={ROUTES.REGISTER} 
                className="font-semibold text-brand hover:text-brand/90 transition-colors inline-flex items-center gap-1"
              >
                Create one <ArrowRight size={14} />
              </Link>
            </p>
          </Card>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
