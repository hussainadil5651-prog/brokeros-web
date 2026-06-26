'use client'

import { useState, FormEvent, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const emailRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [isSignup, setIsSignup] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError('')
    if (!email.trim()) { setError('Email is required'); emailRef.current?.focus(); return }
    if (!password) { setError('Password is required'); return }
    if (isSignup && password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    const result = await signIn('credentials', { email: email.trim().toLowerCase(), password, redirect: false })
    setLoading(false)
    if (result?.error) { setError(isSignup ? 'Email already exists or invalid credentials' : 'Invalid email or password'); return }
    router.replace('/dashboard')
  }

  async function handleGoogle() { setGoogleLoading(true); await signIn('google', { callbackUrl: '/dashboard' }) }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#f8f7f4] p-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-100/30 blur-[150px]" />
      </div>
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4" style={{ width: 72, height: 72 }}>
            <svg viewBox="0 0 72 72" className="h-18 w-18">
              <defs>
                <linearGradient id="cabG2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#fbbf24" /></linearGradient>
                <linearGradient id="trailerG2" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#374151" /><stop offset="100%" stopColor="#1f2937" /></linearGradient>
              </defs>
              <ellipse cx="36" cy="66" rx="30" ry="3" fill="rgba(0,0,0,0.08)" />
              <rect x="8" y="20" width="38" height="28" rx="3" fill="url(#trailerG2)" stroke="#6b7280" strokeWidth="1" />
              <rect x="48" y="22" width="18" height="24" rx="2" fill="url(#cabG2)" stroke="#d97706" strokeWidth="1" />
              <rect x="56" y="25" width="6" height="10" rx="0.8" fill="#111827" opacity="0.6" />
              <circle cx="20" cy="48" r="5.5" fill="#374151" stroke="#1f2937" strokeWidth="1" /><circle cx="20" cy="48" r="2.5" fill="#6b7280" />
              <circle cx="36" cy="48" r="5.5" fill="#374151" stroke="#1f2937" strokeWidth="1" /><circle cx="36" cy="48" r="2.5" fill="#6b7280" />
              <circle cx="56" cy="48" r="5.5" fill="#374151" stroke="#1f2937" strokeWidth="1" /><circle cx="56" cy="48" r="2.5" fill="#6b7280" />
              <rect x="13" y="24" width="28" height="2" rx="0.5" fill="#6b7280" opacity="0.3" />
              <rect x="13" y="28" width="28" height="2" rx="0.5" fill="#6b7280" opacity="0.3" />
              <rect x="13" y="32" width="28" height="2" rx="0.5" fill="#6b7280" opacity="0.3" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-amber-600">FreightOS</h1>
          <p className="mt-1 text-sm text-[#9a9589]">{isSignup ? 'Create your account' : 'Broker Command Center'}</p>
        </div>

        <button onClick={handleGoogle} disabled={googleLoading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#e8e6e1] bg-white px-4 py-2.5 text-sm font-medium text-[#6b6960] transition-all hover:bg-[#f3f2ee] disabled:opacity-50 shadow-sm">
          {googleLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#d6d4cc] border-t-amber-500" /> : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Sign in with Google
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#e8e6e1]" />
          <span className="text-xs text-[#9a9589]">or</span>
          <div className="h-px flex-1 bg-[#e8e6e1]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="kpi-label">Email</label>
            <input ref={emailRef} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="input w-full" />
          </div>
          <div>
            <label className="kpi-label">Password</label>
            <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isSignup ? 'Min 6 characters' : '••••••••'} className="input w-full" />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 border border-red-200">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <span className="flex items-center justify-center gap-2"><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />{isSignup ? 'Creating account...' : 'Signing in'}</span> : isSignup ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-[#9a9589]">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => { setIsSignup(!isSignup); setError('') }} className="text-amber-600 hover:text-amber-700 font-medium">
            {isSignup ? 'Sign in' : 'Sign up free'}
          </button>
        </p>

        <p className="mt-8 text-center text-[10px] text-[#9a9589]">FreightOS © {new Date().getFullYear()}</p>
      </div>
    </main>
  )
}
