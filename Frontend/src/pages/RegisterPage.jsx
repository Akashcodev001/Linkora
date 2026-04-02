import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Globe, Sparkles, ShieldCheck, UserPlus, Mail, LockKeyhole, ArrowRight } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useRegisterMutation } from '@/app/api/authApi'
import { ROUTES } from '@/constants/routes'
import toast from 'react-hot-toast'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

function buildOAuthUrl(provider) {
  return `${API_BASE}/auth/${provider}?client=web`
}

export function RegisterPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [registerUser, { isLoading }] = useRegisterMutation()
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')
    setSuccessMessage('')

    if (!username.trim() || !email.trim() || !password.trim()) {
      const msg = 'Username, email and password are required.'
      setFormError(msg)
      toast.error(msg)
      return
    }

    if (password.trim().length < 8) {
      const msg = 'Password must be at least 8 characters.'
      setFormError(msg)
      toast.error(msg)
      return
    }

    try {
      await registerUser({
        username: username.trim(),
        email: email.trim(),
        password,
      }).unwrap()

      const successMsg = 'Account created! A verification email has been sent. Please check your inbox.'
      setSuccessMessage(successMsg)
      toast.success(successMsg, { duration: 5000 })

      window.setTimeout(() => {
        navigate(ROUTES.LOGIN, {
          replace: true,
          state: { prefillEmail: email.trim() },
        })
      }, 2500)
    } catch (error) {
      // Handle network/connection errors
      if (error?.status === undefined || error?.message?.includes('ERR_CONNECTION_REFUSED')) {
        const msg = 'Cannot connect to server. Please ensure the backend is running on http://localhost:3000'
        setFormError(msg)
        toast.error(msg)
        return
      }

      // Handle validation errors and other server errors
      const fallbackMessage = 'Could not create account. Please try again.'
      const errorMsg = error?.data?.message || error?.message || fallbackMessage
      setFormError(errorMsg)
      toast.error(errorMsg)
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-bg-base p-4">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_8%_18%,rgba(14,165,233,0.12),transparent_38%),radial-gradient(circle_at_90%_16%,rgba(249,115,22,0.14),transparent_40%),radial-gradient(circle_at_50%_86%,rgba(34,197,94,0.1),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-10 -z-10 mx-auto h-48 w-[95vw] max-w-5xl rounded-full bg-state-info/8 blur-3xl" />

      <section className="grid w-full max-w-6xl gap-6 md:grid-cols-[1fr_1.1fr]">
        {/* Left Panel - Form */}
        <div className="space-y-4">
          <Card className="w-full" padding="comfortable">
            <div className="space-y-2 mb-6">
              <h2 className="text-2xl font-semibold text-text-primary flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-state-info/15">
                  <UserPlus size={18} className="text-state-info" />
                </div>
                Create account
              </h2>
              <p className="text-sm text-text-muted">Join Linkora with Google, GitHub, or email.</p>
            </div>

            {/* Social Signup Buttons */}
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

            {/* Registration Form */}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-sm font-medium text-text-secondary mb-2 block">Username</label>
                <Input
                  type="text"
                  placeholder="Choose a unique username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="bg-bg-base/60 border-border/70 focus:border-state-info/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary mb-2 block">Email Address</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="bg-bg-base/60 border-border/70 focus:border-state-info/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary mb-2 block">Password</label>
                <Input
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="bg-bg-base/60 border-border/70 focus:border-state-info/50"
                />
              </div>

              {formError && (
                <div className="rounded-lg border border-state-error/30 bg-state-error/5 px-4 py-3">
                  <p className="text-sm text-state-error font-medium">{formError}</p>
                </div>
              )}

              {successMessage && (
                <div className="rounded-lg border border-state-success/30 bg-state-success/5 px-4 py-3">
                  <p className="text-sm text-state-success font-medium">{successMessage}</p>
                </div>
              )}

              <Button 
                className="w-full h-11 font-medium group" 
                type="submit" 
                loading={isLoading}
              >
                {isLoading ? 'Creating account...' : (
                  <>
                    Sign up
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          </Card>

          {/* Login Link */}
          <Card className="w-full bg-gradient-to-r from-bg-base to-bg-base" padding="comfortable">
            <p className="text-center text-sm text-text-secondary">
              Already have an account?{' '}
              <Link 
                to={ROUTES.LOGIN} 
                className="font-semibold text-brand hover:text-brand/90 transition-colors inline-flex items-center gap-1"
              >
                Sign in <ArrowRight size={14} />
              </Link>
            </p>
          </Card>
        </div>

        {/* Right Panel - Info */}
        <Card className="relative hidden min-h-[600px] overflow-hidden md:flex flex-col justify-between" padding="comfortable">
          <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-state-info/12 blur-3xl" />
          <div className="absolute -right-20 -bottom-24 h-64 w-64 rounded-full bg-brand/12 blur-3xl" />
          
          <div className="relative z-10 space-y-8">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-state-info/20 bg-state-info/5 px-3.5 py-2 text-xs font-medium text-state-info">
                <Sparkles size={14} className="animate-pulse" />
                Get Started Today
              </p>
              <h1 className="mt-6 text-4xl font-bold leading-tight text-text-primary">
                Build your
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-state-info to-blue-400"> knowledge graph</span>
              </h1>
              <p className="mt-4 max-w-sm text-base text-text-secondary leading-relaxed">
                Capture, organize, and resurface your valuable insights with AI-powered analysis. Start gathering knowledge from across the web.
              </p>
            </div>

            <div className="space-y-3 pt-4 divide-y divide-border/30">
              <div className="flex items-start gap-3 py-3">
                <Mail size={18} className="text-state-info flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Email Verification</p>
                  <p className="text-xs text-text-muted mt-0.5">Secure your account after signup</p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-3">
                <LockKeyhole size={18} className="text-state-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-text-primary">End-to-End Safe</p>
                  <p className="text-xs text-text-muted mt-0.5">OAuth + JWT tokens with auto-refresh</p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-3">
                <ShieldCheck size={18} className="text-state-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Admin Protected</p>
                  <p className="text-xs text-text-muted mt-0.5">Full role-based access control</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 rounded-lg border border-state-info/20 bg-gradient-to-br from-state-info/10 to-transparent p-4">
            <p className="text-xs font-medium text-text-muted uppercase tracking-widest">Why Linkora:</p>
            <p className="mt-2 text-sm text-text-secondary">Advanced knowledge management for professionals who want to remember everything that matters.</p>
          </div>
        </Card>
      </section>
    </main>
  )
}

export default RegisterPage
