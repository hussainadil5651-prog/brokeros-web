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
      const r = await fetch(`/api/batches?date=${selectedDay}`)
      if (r.ok) {
        const d = await r.json()
        setBatches(d.batches ?? [])
      } else {
        setError('Failed to load batches')
      }
    } catch {
      setError('Network error — check your connection')
    } finally { setLoading(false) }
  }, [selectedDay])

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
    return <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]"><div className="spinner" /></div>
  }

  const dayLabel = weekDates.find(w => w.date === selectedDay)?.label ?? selectedDay

  return (
    <main className="page-container">
      <div className="section-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Shipper Outreach</h1>
            <p className="page-subtitle">Create email batches per day · each day has unique emails</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Day selector */}
        <div className="flex items-center gap-2">
          {weekDates.map(w => (
            <button key={w.date} onClick={() => setSelectedDay(w.date)}
              className={`rounded-lg border px-4 py-2.5 text-xs font-semibold tracking-wide transition-all ${
                selectedDay === w.date
                  ? 'border-amber-300 bg-amber-50 text-amber-700 shadow-sm'
                  : 'border-[#e8e6e1] text-[#9a9589] hover:bg-[#f3f2ee] hover:text-[#6b6960]'
              }`}>
              {w.label}<br /><span className="text-[10px] font-mono opacity-60">{w.date}</span>
            </button>
          ))}
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#9a9589]">
            {dayLabel} · {dayBatches.length} batch{dayBatches.length !== 1 ? 'es' : ''}
            · {dayBatches.reduce((a, b) => a + b.emails.length, 0)} emails total
          </p>
          <div className="flex gap-2">
            <button onClick={createBatches} disabled={creating}
              className="btn-primary disabled:opacity-50">
              {creating ? 'Creating...' : 'Create Batches'}
            </button>
            <button onClick={fetchBatches} className="btn-secondary">Refresh</button>
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Batch cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner" />
          </div>
        ) : dayBatches.length === 0 ? (
          <div className="empty-state">
            <p>No batches for {dayLabel}</p>
            <p className="text-xs">Click &ldquo;Create Batches&rdquo; to generate email batches for this day</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {dayBatches.map(batch => (
              <div key={batch.id} className={`card p-5 transition-all ${
                batch.sent ? 'border-green-200 bg-green-50/50' : ''
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button onClick={() => toggleBatchSent(batch.id, batch.sent)}
                      className={`flex h-5 w-5 items-center justify-center rounded border transition-all ${
                        batch.sent ? 'border-green-500 bg-green-500 text-white' : 'border-[#d6d4cc]'
                      }`}>
                      {batch.sent ? <span className="text-[10px] font-bold">✓</span> : ''}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#1a1917]">
                          Batch #{batch.batchNumber}
                        </span>
                        {batch.sent && <span className="badge-green">Sent</span>}
                      </div>
                      <p className="text-xs text-[#9a9589]">{batch.emails.length} emails · {batch.assignedTo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => deleteBatch(batch.id)} className="text-[10px] text-[#9a9589] hover:text-red-500 transition-colors">Delete</button>
                  </div>
                </div>
                {/* Preview first few emails */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {batch.emails.slice(0, 5).map((email, i) => (
                    <span key={i} className="rounded-md bg-[#f3f2ee] px-1.5 py-0.5 text-[10px] font-mono text-[#9a9589]">{email}</span>
                  ))}
                  {batch.emails.length > 5 && (
                    <span className="text-[10px] text-[#9a9589] self-center">+{batch.emails.length - 5} more</span>
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
