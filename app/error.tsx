'use client'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const msg = error?.message ?? 'Something went wrong'
  const truncated = msg.length > 200 ? msg.slice(0, 200) + '...' : msg

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-8">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <svg viewBox="0 0 48 48" className="h-16 w-16 opacity-40">
          <rect x="8" y="12" width="22" height="16" rx="2" fill="#1c1917" stroke="#44403c" strokeWidth="0.6" />
          <path d="M30 16 L30 28 L42 28 L42 22 L38 16 Z" fill="#f59e0b" stroke="#d97706" strokeWidth="0.6" opacity="0.5" />
          <circle cx="16" cy="28" r="3" fill="#292524" />
          <circle cx="24" cy="28" r="3" fill="#292524" />
          <circle cx="36" cy="28" r="3" fill="#292524" />
        </svg>
        <h1 className="text-lg font-semibold text-zinc-400">Something went wrong</h1>
        <p className="text-xs text-zinc-700 font-mono max-w-sm break-words">{truncated}</p>
        <div className="flex gap-3 mt-2">
          <button onClick={reset} className="rounded-md bg-amber-500 px-5 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 press">
            Try again
          </button>
          <a href="/dashboard" className="rounded-md border border-white/[0.06] px-5 py-2 text-xs text-zinc-500 transition hover:bg-white/[0.03] press">
            Go to Dashboard
          </a>
        </div>
      </div>
    </main>
  )
}
