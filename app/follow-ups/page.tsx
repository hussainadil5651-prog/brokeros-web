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
    setLoading(true)
    setFetchError('')
    try {
      const [fuR, remR] = await Promise.all([
        fetch('/api/follow-ups'),
        fetch('/api/broker?type=reminders-due'),
      ])
      if (fuR.ok) setItems((await fuR.json()).followUps ?? [])
      else setFetchError('Failed to load follow-ups')
      if (remR.ok) { const d = await remR.json(); setReminders(d.reminders ?? []) }
    } catch { setFetchError('Network error — check your connection') } finally { setLoading(false) }
  }

  useEffect(() => { if (authStatus === 'authenticated') fetchAll() }, [authStatus])

  async function markDone(id: string) {
    try {
      const r = await fetch('/api/follow-ups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followUpId: id, completed: true }) })
      if (r.ok) await fetchAll()
    } catch {}
  }

  async function completeReminder(id: string) {
    try {
      const r = await fetch('/api/broker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'complete-reminder', reminderId: id }) })
      if (r.ok) setReminders(prev => prev.filter(r => r.id !== id))
    } catch {}
  }

  const today = new Date().toISOString().split('T')[0]
  const overdue = items.filter(i => !i.completed && i.dueDate < today)
  const dueToday = items.filter(i => !i.completed && i.dueDate === today)
  const upcoming = items.filter(i => !i.completed && i.dueDate > today)
  const done = items.filter(i => i.completed)
  const dueReminders = reminders.filter(r => r.remindAt <= today && !r.completed)

  if (authStatus === 'loading' || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div>
  }

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="relative border-b border-white/[0.06] px-6 py-4 before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-gradient-to-r before:from-amber-500 before:to-amber-500/0">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Follow-ups</h1>
        <p className="text-xs text-zinc-600">{overdue.length} overdue · {dueToday.length} due today · {dueReminders.length} reminders{fetchError && <span className="ml-2 text-rose-400">· {fetchError}</span>}</p>
      </div>
      <div className="p-6 space-y-6">
        {/* Reminders section */}
        {dueReminders.length > 0 && (
          <div>
            <p className="text-xs font-semibold tracking-wider uppercase mb-2 text-rose-400">Reminders Due ({dueReminders.length})</p>
            <div className="space-y-1">
              {dueReminders.map(r => (
                <div key={r.id} className="card-highlight flex items-center justify-between rounded-lg border border-rose-500/30 bg-zinc-900/50 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-400">{r.email}</span>
                      <span className="text-xs text-zinc-300">{r.companyName}</span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5">{r.notes}</p>
                    {r.draftedEmail && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[10px] text-amber-500 kinetic">Drafted email</summary>
                        <pre className="mt-1 whitespace-pre-wrap rounded bg-zinc-950 p-2 text-[10px] text-zinc-500">{r.draftedEmail}</pre>
                      </details>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="font-mono text-[10px] text-rose-400">{r.remindAt}</span>
                    <button onClick={() => completeReminder(r.id)} className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20 press">Done</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Regular follow-ups */}
        {[
          { title: 'Overdue', items: overdue, color: 'text-rose-400', border: 'border-rose-500/30' },
          { title: 'Due Today', items: dueToday, color: 'text-amber-400', border: 'border-amber-500/30' },
          { title: 'Upcoming', items: upcoming, color: 'text-blue-400', border: 'border-blue-500/30' },
          { title: 'Completed', items: done, color: 'text-emerald-400', border: 'border-emerald-500/30' },
        ].map(s => s.items.length > 0 && (
          <div key={s.title}>
            <p className={`text-xs font-semibold tracking-wider uppercase mb-2 ${s.color}`}>{s.title} ({s.items.length})</p>
            <div className="space-y-1">
              {s.items.map(fu => (
                <div key={fu.id} className={`card-highlight flex items-center justify-between rounded-lg border ${s.border} bg-zinc-900/50 px-4 py-3`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-500">{fu.email}</span>
                      {fu.batchNumber > 0 && <Link href={`/batches/${fu.batchId}`} className="text-[9px] text-amber-500 kinetic">Batch #{fu.batchNumber}</Link>}
                    </div>
                    {fu.notes && <p className="text-xs text-zinc-600 mt-0.5">{fu.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className={`font-mono text-[10px] ${fu.dueDate < today && !fu.completed ? 'text-rose-400' : 'text-zinc-600'}`}>{fu.dueDate}</span>
                    {!fu.completed && <button onClick={() => markDone(fu.id)} className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20 press">Done</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && dueReminders.length === 0 && <div className="py-20 text-center"><p className="text-zinc-600">No follow-ups or reminders</p></div>}
      </div>
    </main>
  )
}
