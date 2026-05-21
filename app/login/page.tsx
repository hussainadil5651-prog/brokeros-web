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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Email is required')
      emailRef.current?.focus()
      return
    }
    if (!password) {
      setError('Password is required')
      return
    }

    setLoading(true)
    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    })
    setLoading(false)

    if (result?.error) {
      setError('Invalid email or password')
      return
    }

    router.replace('/dashboard')
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    await signIn('google', { callbackUrl: '/dashboard' })
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.03] blur-[150px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 perspective-500" style={{ width: 72, height: 72 }}>
            <svg viewBox="0 0 72 72" className="h-18 w-18 transition-transform duration-700 hover:rotate-y-12 hover:scale-110" style={{ transformStyle: 'preserve-3d' }}>
              <defs>
                <linearGradient id="cabG2" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#fbbf24" />
                </linearGradient>
                <linearGradient id="trailerG2" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#292524" />
                  <stop offset="100%" stopColor="#1c1917" />
                </linearGradient>
              </defs>
              <ellipse cx="36" cy="66" rx="30" ry="3" fill="rgba(0,0,0,0.3)" />
              <rect x="8" y="20" width="38" height="28" rx="3" fill="url(#trailerG2)" stroke="#44403c" strokeWidth="1" />
              <rect x="48" y="22" width="18" height="24" rx="2" fill="url(#cabG2)" stroke="#d97706" strokeWidth="1" />
              <rect x="56" y="25" width="6" height="10" rx="0.8" fill="#0c0a09" opacity="0.6" />
              <circle cx="20" cy="48" r="5.5" fill="#292524" stroke="#1c1917" strokeWidth="1" />
              <circle cx="20" cy="48" r="2.5" fill="#44403c" />
              <circle cx="36" cy="48" r="5.5" fill="#292524" stroke="#1c1917" strokeWidth="1" />
              <circle cx="36" cy="48" r="2.5" fill="#44403c" />
              <circle cx="56" cy="48" r="5.5" fill="#292524" stroke="#1c1917" strokeWidth="1" />
              <circle cx="56" cy="48" r="2.5" fill="#44403c" />
              <rect x="13" y="24" width="28" height="2" rx="0.5" fill="#44403c" opacity="0.3" />
              <rect x="13" y="28" width="28" height="2" rx="0.5" fill="#44403c" opacity="0.3" />
              <rect x="13" y="32" width="28" height="2" rx="0.5" fill="#44403c" opacity="0.3" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-amber-400">AFA FreightOS</h1>
          <p className="mt-1 text-sm text-zinc-600">Broker Command Center</p>
        </div>

        {/* Google Sign-In */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/[0.06] bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 press disabled:opacity-50"
        >
          {googleLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border border-zinc-500 border-t-amber-400" />
          ) : (
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
          <div className="h-px flex-1 bg-white/[0.04]" />
          <span className="text-xs text-zinc-700">or</span>
          <div className="h-px flex-1 bg-white/[0.04]" />
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-zinc-500">
              Email
            </label>
            <input
              ref={emailRef}
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="adil@afadispatch.com"
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/20"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-zinc-500">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/20"
            />
          </div>

          {error && (
            <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="glow-amber w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 press disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border border-zinc-950/30 border-t-zinc-950" />
                Signing in
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-[10px] text-zinc-700">
          Authorised agents only &middot; AFA DISPATCH &copy; {new Date().getFullYear()}
        </p>
      </div>
    </main>
  )
}
