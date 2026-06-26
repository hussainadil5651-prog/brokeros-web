'use client'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const msg = error?.message ?? 'Something went wrong'
  const truncated = msg.length > 200 ? msg.slice(0, 200) + '...' : msg

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f8f7f4] p-8">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-2xl">⚠</div>
        <h1 className="text-lg font-semibold text-[#1a1917]">Something went wrong</h1>
        <p className="text-xs text-[#9a9589] font-mono max-w-sm break-words">{truncated}</p>
        <div className="flex gap-3 mt-2">
          <button onClick={reset} className="btn-primary">Try again</button>
          <a href="/dashboard" className="btn-secondary">Go to Dashboard</a>
        </div>
      </div>
    </main>
  )
}
