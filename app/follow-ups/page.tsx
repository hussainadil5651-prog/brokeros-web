'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface FollowUp { id: string; email: string; batchId: string; batchNumber: number; dueDate: string; notes: string; completed: boolean; createdAt: string }
interface Reminder { id: string; email: string; companyName: string; contactName: string; notes: string; remindAt: string; draftedEmail: string; completed: boolean; createdAt: string }

export default function FollowUpsPage() {
  const { status: authStatus } = useSession()
  const [items, setItems] = useState<FollowUp[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  async function fetchAll() {
    setLoading(true); setFetchError('')
    try {
      const [fuR, remR] = await Promise.all([fetch('/api/follow-ups'), fetch('/api/broker?type=reminders-due')])
      if (fuR.ok) setItems((await fuR.json()).followUps ?? []); else setFetchError('Failed to load follow-ups')
      if (remR.ok) { const d = await remR.json(); setReminders(d.reminders ?? []) }
    } catch { setFetchError('Network error — check your connection') } finally { setLoading(false) }
  }

  useEffect(() => { if (authStatus === 'authenticated') fetchAll() }, [authStatus])

  async function markDone(id: string) {
    try { const r = await fetch('/api/follow-ups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followUpId: id, completed: true }) }); if (r.ok) await fetchAll() } catch {}
  }

  async function completeReminder(id: string) {
    try { const r = await fetch('/api/broker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'complete-reminder', reminderId: id }) }); if (r.ok) setReminders(prev => prev.filter(r => r.id !== id)) } catch {}
  }

  const today = new Date().toISOString().split('T')[0]
  const overdue = items.filter(i => !i.completed && i.dueDate < today)
  const dueToday = items.filter(i => !i.completed && i.dueDate === today)
  const upcoming = items.filter(i => !i.completed && i.dueDate > today)
  const done = items.filter(i => i.completed)
  const dueReminders = reminders.filter(r => r.remindAt <= today && !r.completed)

  if (authStatus === 'loading' || loading) return <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]"><div className="spinner" /></div>

  return (
    <main className="page-container">
      <div className="section-header">
        <h1 className="page-title">Follow-ups</h1>
        <p className="page-subtitle">{overdue.length} overdue · {dueToday.length} due today · {dueReminders.length} reminders{fetchError && <span className="ml-2 text-red-500">· {fetchError}</span>}</p>
      </div>
      <div className="p-6 space-y-6">
        {dueReminders.length > 0 && (
          <div>
            <p className="kpi-label text-red-500">Reminders Due ({dueReminders.length})</p>
            <div className="space-y-1">
              {dueReminders.map(r => (
                <div key={r.id} className="card border-red-200 bg-red-50/50 flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[#6b6960]">{r.email}</span>
                      <span className="text-xs text-[#1a1917]">{r.companyName}</span>
                    </div>
                    <p className="text-xs text-[#9a9589] mt-0.5">{r.notes}</p>
                    {r.draftedEmail && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[10px] text-amber-600">Drafted email</summary>
                        <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-[#f8f7f4] p-2 text-[10px] text-[#6b6960]">{r.draftedEmail}</pre>
                      </details>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="font-mono text-[10px] text-red-500">{r.remindAt}</span>
                    <button onClick={() => completeReminder(r.id)} className="btn-primary text-[10px]">Done</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {[
          { title: 'Overdue', items: overdue, color: 'text-red-500', border: 'border-red-200' },
          { title: 'Due Today', items: dueToday, color: 'text-amber-600', border: 'border-amber-200' },
          { title: 'Upcoming', items: upcoming, color: 'text-blue-600', border: 'border-blue-200' },
          { title: 'Completed', items: done, color: 'text-emerald-600', border: 'border-emerald-200' },
        ].map(s => s.items.length > 0 && (
          <div key={s.title}>
            <p className={`kpi-label ${s.color}`}>{s.title} ({s.items.length})</p>
            <div className="space-y-1">
              {s.items.map(fu => (
                <div key={fu.id} className={`card border ${s.border} flex items-center justify-between px-4 py-3`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[#6b6960]">{fu.email}</span>
                      {fu.batchNumber > 0 && <Link href={`/batches/${fu.batchId}`} className="text-[9px] text-amber-600">Batch #{fu.batchNumber}</Link>}
                    </div>
                    {fu.notes && <p className="text-xs text-[#9a9589] mt-0.5">{fu.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className={`font-mono text-[10px] ${fu.dueDate < today && !fu.completed ? 'text-red-500' : 'text-[#9a9589]'}`}>{fu.dueDate}</span>
                    {!fu.completed && <button onClick={() => markDone(fu.id)} className="btn-primary text-[10px]">Done</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && dueReminders.length === 0 && <div className="empty-state"><p>No follow-ups or reminders</p></div>}
      </div>
    </main>
  )
}
