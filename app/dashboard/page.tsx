'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface Load { id: string; loadNumber: string; customerName: string; carrierName: string; pickUpLocation: string; deliveryLocation: string; pickUpDate: string; rate: number; carrierCost: number; profit: number; status: string; company: string; invoiceStatus: string }
interface Reminder { id: string; email: string; companyName: string; contactName: string; notes: string; remindAt: string; draftedEmail: string; completed: boolean; createdAt: string }

function monthKey(d: string): string {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return `${MONTHS_SHORT[date.getMonth()]}-${date.getFullYear()}`
}

function currentMonthKey(): string {
  const n = new Date()
  return `${MONTHS_SHORT[n.getMonth()]}-${n.getFullYear()}`
}

export default function DashboardPage() {
  const { status: authStatus } = useSession()
  const router = useRouter()
  const [loads, setLoads] = useState<Load[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [monthFilter, setMonthFilter] = useState(currentMonthKey())
  const [search, setSearch] = useState('')
  const [prospectsCount, setProspectsCount] = useState(0)
  const [customersCount, setCustomersCount] = useState(0)
  const [carriersCount, setCarriersCount] = useState(0)
  const [dueReminders, setDueReminders] = useState<Reminder[]>([])
  const [batchCount, setBatchCount] = useState(0)
  const [todayFollowUps, setTodayFollowUps] = useState(0)
  const [savingStatus, setSavingStatus] = useState<string | null>(null)
  const [statusError, setStatusError] = useState('')

  async function fetchAll() {
    setLoading(true)
    setLoadError('')
    try {
      const results = await Promise.allSettled([
        fetch('/api/loads'),
        fetch('/api/broker?type=prospects'),
        fetch('/api/broker?type=customers'),
        fetch('/api/broker?type=carriers'),
        fetch('/api/broker?type=reminders-due'),
        fetch('/api/follow-ups/count'),
      ])

      if (results[0].status === 'fulfilled' && results[0].value.ok) {
        const d = await results[0].value.json()
        setLoads(d.loads ?? [])
      }
      if (results[1].status === 'fulfilled' && results[1].value.ok) {
        const d = await results[1].value.json()
        setProspectsCount(d.prospects?.length ?? 0)
      }
      if (results[2].status === 'fulfilled' && results[2].value.ok) {
        const d = await results[2].value.json()
        setCustomersCount(d.customers?.length ?? 0)
      }
      if (results[3].status === 'fulfilled' && results[3].value.ok) {
        const d = await results[3].value.json()
        setCarriersCount(d.carriers?.length ?? 0)
      }
      if (results[4].status === 'fulfilled' && results[4].value.ok) {
        const d = await results[4].value.json()
        setDueReminders(d.reminders ?? [])
      }
      if (results[5].status === 'fulfilled' && results[5].value.ok) {
        const d = await results[5].value.json()
        setTodayFollowUps(d.total ?? 0)
      }

      try {
        const batchesR = await fetch('/api/batches')
        if (batchesR.ok) { const d = await batchesR.json(); setBatchCount(d.batches?.length ?? 0) }
      } catch {}
    } catch {
      setLoadError('Failed to load dashboard data. Check your connection and try again.')
    } finally { setLoading(false) }
  }

  useEffect(() => { if (authStatus === 'authenticated') fetchAll() }, [authStatus])
  useEffect(() => { if (authStatus === 'unauthenticated') router.replace('/login') }, [authStatus, router])

  const months = [...new Set(loads.map(l => monthKey(l.pickUpDate)).filter(Boolean))].sort()
  const currentLoads = monthFilter ? loads.filter(l => monthKey(l.pickUpDate) === monthFilter) : []
  const filtered = search ? currentLoads.filter(l => {
    const s = search.toLowerCase()
    return (l.loadNumber || '').toLowerCase().includes(s)
      || (l.customerName || '').toLowerCase().includes(s)
      || (l.pickUpLocation || '').toLowerCase().includes(s)
      || (l.carrierName || '').toLowerCase().includes(s)
  }) : currentLoads

  const totalProfit = currentLoads.reduce((a, l) => a + (l.profit ?? 0), 0)
  const delivered = currentLoads.filter(l => l.status === 'delivered').length
  const inTransit = currentLoads.filter(l => l.status === 'in_transit').length

  if (authStatus === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div>
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950">
        <div className="relative border-b border-white/[0.06] px-6 py-4 before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-gradient-to-r before:from-amber-500 before:to-amber-500/0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Dashboard</h1>
              <p className="text-xs text-zinc-600">Loading data...</p>
            </div>
            <button disabled className="rounded-md border border-white/[0.06] px-3 py-1.5 text-xs text-zinc-500 opacity-50">Loading...</button>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="rounded-lg border border-white/[0.06] bg-zinc-900/30 p-4"><div className="h-3 w-20 rounded bg-zinc-800/50 animate-pulse" /><div className="mt-2 h-7 w-16 rounded bg-zinc-800/50 animate-pulse" /></div>)}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="relative border-b border-white/[0.06] px-6 py-4 before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-gradient-to-r before:from-amber-500 before:to-amber-500/0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Dashboard</h1>
            <p className="text-xs text-zinc-600">{loads.length} total loads · {batchCount} batches · {dueReminders.length} reminders</p>
          </div>
          <div className="flex items-center gap-2">
            {loadError && <span className="text-[10px] text-rose-400">{loadError}</span>}
            <button onClick={fetchAll} disabled={loading} className="rounded-md border border-white/[0.06] px-3 py-1.5 text-xs text-zinc-500 transition hover:bg-white/[0.03] press disabled:opacity-50">{loading ? 'Loading...' : 'Refresh'}</button>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-2.5">
          <Link href="/dispatch" className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-3 transition hover:bg-zinc-900/80">
            <p className="text-[9px] font-semibold tracking-widest text-zinc-500 uppercase">Active Loads</p>
            <p className="mt-0.5 font-mono text-xl font-bold text-zinc-100">{currentLoads.length}</p>
            <p className="text-[9px] text-zinc-600">{inTransit} in transit</p>
          </Link>
          <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-3">
            <p className="text-[9px] font-semibold tracking-widest text-zinc-500 uppercase">Total Profit</p>
            <p className="mt-0.5 font-mono text-xl font-bold text-emerald-400">+${totalProfit.toLocaleString()}</p>
            <p className="text-[9px] text-zinc-600">{delivered} delivered</p>
          </div>
          <Link href="/outreach" className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-3 transition hover:bg-zinc-900/80">
            <p className="text-[9px] font-semibold tracking-widest text-zinc-500 uppercase">Email Batches</p>
            <p className="mt-0.5 font-mono text-xl font-bold text-amber-400">{batchCount}</p>
            <p className="text-[9px] text-zinc-600">{prospectsCount} prospects · {customersCount} customers</p>
          </Link>
          <Link href="/follow-ups" className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-3 transition hover:bg-zinc-900/80">
            <p className="text-[9px] font-semibold tracking-widest text-zinc-500 uppercase">Follow-ups</p>
            <p className="mt-0.5 font-mono text-xl font-bold text-rose-400">{todayFollowUps + dueReminders.length}</p>
            <p className="text-[9px] text-zinc-600">{todayFollowUps} due · {dueReminders.length} reminders</p>
          </Link>
        </div>

        {/* Due reminders */}
        {dueReminders.length > 0 && (
          <div className="card-highlight rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold tracking-wider text-rose-400 uppercase">Reminders Due</h2>
              <Link href="/follow-ups" className="text-[10px] text-rose-400 kinetic">View all</Link>
            </div>
            <div className="space-y-2">
              {dueReminders.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-md bg-zinc-950/50 px-3 py-2">
                  <div>
                    <p className="text-xs text-zinc-300">{r.companyName || r.email}</p>
                    <p className="text-[10px] text-zinc-600">{r.notes || 'Follow up'}</p>
                  </div>
                  <button onClick={async () => {
                    try {
                      const r2 = await fetch('/api/broker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'complete-reminder', reminderId: r.id }) })
                      if (r2.ok) setDueReminders(prev => prev.filter(x => x.id !== r.id))
                    } catch {}
                  }} className="rounded bg-emerald-500/10 px-2 py-1 text-[9px] text-emerald-400 hover:bg-emerald-500/20 press">Done</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-2.5">
          <Link href="/prospects" className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-3 transition hover:bg-zinc-900/80">
            <p className="text-[9px] font-semibold tracking-widest text-zinc-500 uppercase">Prospects</p>
            <p className="mt-0.5 font-mono text-lg font-bold text-amber-400">{prospectsCount}</p>
            <p className="text-[9px] text-zinc-600">interested leads</p>
          </Link>
          <Link href="/customers" className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-3 transition hover:bg-zinc-900/80">
            <p className="text-[9px] font-semibold tracking-widest text-zinc-500 uppercase">Customers</p>
            <p className="mt-0.5 font-mono text-lg font-bold text-emerald-400">{customersCount}</p>
            <p className="text-[9px] text-zinc-600">active accounts</p>
          </Link>
          <Link href="/carriers" className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-3 transition hover:bg-zinc-900/80">
            <p className="text-[9px] font-semibold tracking-widest text-zinc-500 uppercase">Carriers</p>
            <p className="mt-0.5 font-mono text-lg font-bold text-blue-400">{carriersCount ?? '—'}</p>
            <p className="text-[9px] text-zinc-600">search records</p>
          </Link>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <select value={months.includes(monthFilter) ? monthFilter : ''} onChange={e => setMonthFilter(e.target.value || currentMonthKey())}
            className="rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 outline-none transition focus:border-amber-500/30">
            {months.length === 0 && <option value="">No data</option>}
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by load#, customer, route, carrier..."
            className="flex-1 rounded-md border border-white/[0.06] bg-zinc-900/50 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
        </div>

        {/* Error message for status update */}
        {statusError && <p className="text-[10px] text-rose-400">{statusError}</p>}

        {/* Load table */}
        <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-3 py-2">Load#</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Route</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Carrier</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">Profit</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-700">No loads found</td></tr>
                )}
                {filtered.map(load => (
                  <tr key={load.id} className="border-b border-white/[0.04] transition hover:bg-white/[0.02]">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-zinc-500">{load.loadNumber}</span>
                        <span className={`rounded px-1 py-0.5 text-[7px] font-mono font-semibold tracking-wider ${load.company === 'ST' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>{load.company}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{load.customerName}</td>
                    <td className="px-3 py-2 text-zinc-500 truncate max-w-[180px]">{load.pickUpLocation} → {load.deliveryLocation}</td>
                    <td className="px-3 py-2 text-zinc-600">{load.pickUpDate}</td>
                    <td className="px-3 py-2 text-zinc-500 truncate max-w-[130px]">{load.carrierName || '—'}</td>
                    <td className="px-3 py-2">
                      <select value={load.status} onChange={async e => {
                        const newStatus = e.target.value
                        setSavingStatus(load.id)
                        setStatusError('')
                        try {
                          const r = await fetch('/api/loads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loadId: load.id, status: newStatus }) })
                          if (r.ok) {
                            const d = await r.json()
                            if (d.load) setLoads(prev => prev.map(l => l.id === load.id ? d.load : l))
                          } else {
                            const d = await r.json().catch(() => ({}))
                            setStatusError(d.error || 'Failed to update status')
                          }
                        } catch { setStatusError('Network error — status not saved') } finally { setSavingStatus(null) }
                      }} disabled={savingStatus === load.id}
                        className={`rounded border px-2 py-0.5 text-[10px] font-medium outline-none transition ${
                          load.status === 'delivered' ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' :
                          load.status === 'paid' ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400' :
                          load.status === 'in_transit' ? 'border-amber-500/40 bg-amber-500/20 text-amber-300' :
                          'border-amber-500/40 bg-amber-500/15 text-amber-400'
                        }`}>
                        <option value="quote">Quote</option>
                        <option value="booked">Booked</option>
                        <option value="dispatched">Dispatched</option>
                        <option value="in_transit">In Transit</option>
                        <option value="delivered">Delivered</option>
                        <option value="invoiced">Invoiced</option>
                        <option value="paid">Paid</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-amber-400">${load.rate?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-400">+${(load.profit ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <Link href={`/loads/${load.id}`} className="rounded border border-white/[0.06] px-1.5 py-0.5 text-[8px] text-zinc-500 hover:text-zinc-300 press">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
