'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [outreachSheetIds, setOutreachSheetIds] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    if (status !== 'authenticated') return

    fetch('/api/user/config')
      .then(r => r.json())
      .then(data => {
        setOutreachSheetIds(data.outreachSheetIds?.join(', ') ?? '')
        setName(data.name ?? session.user?.name ?? '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [status, router, session])

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const ids = outreachSheetIdList()
      const res = await fetch('/api/user/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outreachSheetIds: ids, name }),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully' })
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally { setSaving(false) }
  }

  function outreachSheetIdList(): string[] {
    return outreachSheetIds.split(',').map(s => s.trim()).filter(Boolean)
  }

  async function handleTest() {
    setTestResult(null)
    const ids = outreachSheetIdList()
    if (ids.length === 0) { setTestResult({ ok: false, text: 'No sheet IDs configured' }); return }

    try {
      const res = await fetch('/api/user/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId: ids[0] }),
      })
      const data = await res.json()
      if (res.ok) {
        setTestResult({ ok: true, text: `Connected! Found ${data.sheets ?? 0} tab(s), ${data.totalEmails ?? 0} total email(s)` })
      } else {
        setTestResult({ ok: false, text: data.error || 'Failed to connect' })
      }
    } catch {
      setTestResult({ ok: false, text: 'Failed to connect to sheet' })
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div>
  }

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="relative border-b border-white/[0.06] px-6 py-4 before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-gradient-to-r before:from-amber-500 before:to-amber-500/0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Settings</h1>
            <p className="mt-0.5 text-sm text-zinc-500">Configure your outreach sheets and preferences</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="card border border-white/[0.06] bg-zinc-900/50">
          <div className="border-b border-white/[0.06] px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-200">Your Outreach Sheets</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Enter the Google Sheet ID(s) that contain email addresses for your outreach batches.
              The app reads ALL tabs in each sheet and extracts emails from the detected email column.
              Separate multiple IDs with commas.
            </p>
          </div>

          <div className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Your Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-lg border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition placeholder:text-zinc-600 focus:border-amber-500/30 focus:outline-none"
                placeholder="Display name"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Outreach Sheet IDs</label>
              <textarea
                value={outreachSheetIds}
                onChange={e => setOutreachSheetIds(e.target.value)}
                className="w-full rounded-lg border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition placeholder:text-zinc-600 focus:border-amber-500/30 focus:outline-none"
                rows={3}
                placeholder="1ABCxyz..., 2DEFabc..."
              />
              <p className="mt-1 text-xs text-zinc-600">
                Share each sheet with <span className="font-mono text-amber-400/60">afa-sheets@afa-dispatch.iam.gserviceaccount.com</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 press disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>

              <button
                onClick={handleTest}
                className="rounded-lg border border-white/[0.08] bg-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-700 press disabled:opacity-50"
                disabled={saving}
              >
                Test Connection
              </button>
            </div>

            {message && (
              <p className={`text-xs ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                {message.text}
              </p>
            )}

            {testResult && (
              <div className={`rounded-lg border px-3 py-2 text-sm ${testResult.ok ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-red-500/20 bg-red-500/5 text-red-400'}`}>
                {testResult.text}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-lg border border-white/[0.06] bg-zinc-900/30 px-5 py-3">
          <div>
            <p className="text-sm text-zinc-400">Signed in as <span className="text-zinc-200">{session?.user?.email}</span></p>
            <p className="text-xs text-zinc-600">
              CW/ST sheets are shared across all partners. Outreach sheets are per-user.
            </p>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="rounded-lg border border-white/[0.06] bg-zinc-800 px-4 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-700 press">
            Sign out
          </button>
        </div>
      </div>
    </main>
  )
}
