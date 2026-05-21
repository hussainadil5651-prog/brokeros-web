'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface Batch { id: string; batchDate: string; batchNumber: number; emails?: string[]; assignedTo: string; status: string; totalEmails: number; createdAt: string; sent?: boolean }

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

function getNextWeekDates(): { label: string; date: string }[] {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? 1 : dayOfWeek === 6 ? 2 : -(dayOfWeek - 1)
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)
  if (monday <= today) monday.setDate(monday.getDate() + 7)

  return DAY_NAMES.map((name, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return { label: name, date: d.toISOString().split('T')[0] }
  })
}

export default function OutreachPage() {
  const { data: session, status: authStatus } = useSession()
  const [weekDates, setWeekDates] = useState(getNextWeekDates())
  const [selectedDay, setSelectedDay] = useState(weekDates[0]?.date ?? '')
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const fetchBatches = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/batches')
      if (r.ok) {
        const d = await r.json()
        setBatches(d.batches ?? [])
      } else {
        setError('Failed to load batches')
      }
    } catch {
      setError('Network error — check your connection')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (authStatus === 'authenticated') fetchBatches() }, [authStatus, fetchBatches])
  useEffect(() => { setWeekDates(getNextWeekDates()) }, [])

  const dayBatches = batches.filter(b => {
    const bd = b.batchDate.split('T')[0] || b.batchDate
    return bd === selectedDay
  }).sort((a, b) => a.batchNumber - b.batchNumber).map(b => ({ ...b, emails: b.emails ?? [] }))

  async function createBatches() {
    if (!selectedDay) return
    setCreating(true)
    setError('')
    try {
      const r = await fetch('/api/batches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDay }),
      })
      if (r.ok) {
        await fetchBatches()
      } else {
        const text = await r.text()
        try { const data = JSON.parse(text); setError(data.error || 'Failed to create batches') }
        catch { setError('Server error — try again') }
      }
    } catch {
      setError('Network error — check your connection')
    } finally { setCreating(false) }
  }

  async function toggleBatchSent(batchId: string, currentSent: boolean | undefined) {
    try {
      const r = await fetch('/api/batches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, sent: !currentSent }),
      })
      if (r.ok) await fetchBatches()
    } catch {}
  }

  async function deleteBatch(batchId: string) {
    try {
      const r = await fetch(`/api/batches?id=${batchId}`, { method: 'DELETE' })
      if (r.ok) await fetchBatches()
    } catch {}
  }

  if (authStatus === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div>
  }

  const dayLabel = weekDates.find(w => w.date === selectedDay)?.label ?? selectedDay

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="relative border-b border-white/[0.06] px-6 py-4 before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-gradient-to-r before:from-amber-500 before:to-amber-500/0">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Shipper Outreach</h1>
        <p className="text-xs text-zinc-600">Create email batches per day · each day has unique emails</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Day selector */}
        <div className="flex items-center gap-2">
          {weekDates.map(w => (
            <button key={w.date} onClick={() => setSelectedDay(w.date)}
              className={`rounded-md border px-4 py-2 text-xs font-semibold tracking-wide transition press ${
                selectedDay === w.date
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                  : 'border-white/[0.06] text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-400'
              }`}>
              {w.label}<br /><span className="text-[10px] font-mono opacity-60">{w.date}</span>
            </button>
          ))}
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-600">
            {dayLabel} &middot; {dayBatches.length} batch{dayBatches.length !== 1 ? 'es' : ''}
            &middot; {dayBatches.reduce((a, b) => a + b.emails.length, 0)} emails total
          </p>
          <div className="flex gap-2">
            <button onClick={createBatches} disabled={creating}
              className="rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 press disabled:opacity-50">
              {creating ? 'Creating...' : 'Create Batches'}
            </button>
            <button onClick={fetchBatches} className="rounded-md border border-white/[0.06] px-4 py-2 text-xs text-zinc-500 hover:bg-white/[0.03] press">Refresh</button>
          </div>
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        {/* Batch cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          </div>
        ) : dayBatches.length === 0 ? (
          <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-8 text-center">
            <p className="text-sm text-zinc-700">No batches for {dayLabel}</p>
            <p className="mt-1 text-xs text-zinc-700">Click &ldquo;Create Batches&rdquo; to generate email batches for this day</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {dayBatches.map(batch => (
              <div key={batch.id} className={`card-highlight rounded-lg border p-4 transition ${
                batch.sent ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/[0.06] bg-zinc-900/50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button onClick={() => toggleBatchSent(batch.id, batch.sent)}
                      className={`flex h-5 w-5 items-center justify-center rounded border transition press ${
                        batch.sent ? 'border-emerald-500 bg-emerald-500 text-zinc-950' : 'border-zinc-600'
                      }`}>
                      {batch.sent ? <span className="text-[10px] font-bold">✓</span> : ''}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/batches/${batch.id}`} className="text-sm font-semibold text-zinc-200 kinetic hover:text-amber-400">
                          Batch #{batch.batchNumber}
                        </Link>
                        {batch.sent && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium text-emerald-400">Sent</span>}
                      </div>
                      <p className="text-xs text-zinc-600">{batch.emails.length} emails &middot; {batch.assignedTo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => deleteBatch(batch.id)} className="text-[10px] text-zinc-700 hover:text-rose-400 press">Delete</button>
                  </div>
                </div>
                {/* Preview first few emails */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {batch.emails.slice(0, 5).map((email, i) => (
                    <span key={i} className="rounded bg-zinc-800/50 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500">{email}</span>
                  ))}
                  {batch.emails.length > 5 && (
                    <span className="text-[10px] text-zinc-700 self-center">+{batch.emails.length - 5} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
