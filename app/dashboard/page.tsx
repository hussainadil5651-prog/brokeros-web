'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface Load { id: string; loadNumber: string; customerName: string; carrierName: string; pickUpLocation: string; deliveryLocation: string; pickUpDate: string; rate: number; carrierCost: number; profit: number; netCommission: number; status: string; company: string; invoiceStatus: string }
interface Reminder { id: string; email: string; companyName: string; contactName: string; notes: string; remindAt: string; draftedEmail: string; completed: boolean; createdAt: string }

function monthKey(d: string): string {
  if (!d) return ''
  // Try standard Date parsing first
  let date = new Date(d)
  if (isNaN(date.getTime())) {
    // Try common sheet formats: MM/DD/YYYY, M/D/YY, DD-MM-YYYY
    const parts = d.split(/[/\-\.]/)
    if (parts.length >= 3) {
      const month = parseInt(parts[0]) || parseInt(parts[1])
      const year = parseInt(parts[2]) || parseInt(parts[0])
      if (month >= 1 && month <= 12 && year > 2000) {
        date = new Date(year, month - 1, 1)
      }
    }
  }
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
  const [monthFilter, setMonthFilter] = useState('')
  const [search, setSearch] = useState('')
  const [prospectsCount, setProspectsCount] = useState(0)
  const [customersCount, setCustomersCount] = useState(0)
  const [carriersCount, setCarriersCount] = useState(0)
  const [dueReminders, setDueReminders] = useState<Reminder[]>([])
  const [batchCount, setBatchCount] = useState(0)
  const [todayFollowUps, setTodayFollowUps] = useState(0)
  const [savingStatus, setSavingStatus] = useState<string | null>(null)
  const [statusError, setStatusError] = useState('')

  const [setupRequired, setSetupRequired] = useState(false)

  async function fetchAll() {
    setLoading(true)
    setLoadError('')
    setSetupRequired(false)
    try {
      const results = await Promise.allSettled([
        fetch('/api/loads'),
        fetch('/api/broker?type=prospects'),
        fetch('/api/broker?type=customers'),
        fetch('/api/broker?type=carriers'),
        fetch('/api/broker?type=reminders-due'),
        fetch('/api/follow-ups/count'),
      ])

      if (results[0].status === 'fulfilled') {
        const r = results[0].value
        if (r.ok) {
          const d = await r.json()
          if (d.setupRequired && !d.loads) { setSetupRequired(true) }
          else { setLoads(d.loads ?? []) }
        }
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
  const currentLoads = monthFilter ? loads.filter(l => monthKey(l.pickUpDate) === monthFilter) : loads
  const filtered = search ? currentLoads.filter(l => {
    const s = search.toLowerCase()
    return (l.loadNumber || '').toLowerCase().includes(s)
      || (l.customerName || '').toLowerCase().includes(s)
      || (l.pickUpLocation || '').toLowerCase().includes(s)
      || (l.carrierName || '').toLowerCase().includes(s)
  }) : currentLoads

  const totalProfit = currentLoads.reduce((a, l) => a + (l.netCommission ?? 0), 0)
  const delivered = currentLoads.filter(l => l.status === 'delivered').length
  const inTransit = currentLoads.filter(l => l.status === 'in_transit').length

  if (authStatus === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]"><div className="spinner" /></div>
  }

  if (setupRequired) {
    return (
      <main className="page-container">
        <div className="section-header">
          <div>
            <h1 className="page-title">Welcome to FreightOS</h1>
            <p className="page-subtitle">Get started by connecting your sheets</p>
          </div>
        </div>
        <div className="p-6">
          <div className="card p-8 text-center max-w-lg mx-auto">
            <div className="text-4xl mb-4">📊</div>
            <h2 className="text-lg font-semibold text-[#1a1917] mb-2">Connect Your Google Sheet</h2>
            <p className="text-sm text-[#6b6960] mb-6">To get started, add your load data sheet and outreach sheets in Settings.</p>
            <a href="/settings" className="btn-primary inline-block">Go to Settings</a>
          </div>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="page-container">
        <div className="section-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-title">Dashboard</h1>
              <p className="page-subtitle">Loading data...</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="card p-5"><div className="h-3 w-20 rounded bg-[#f3f2ee] animate-pulse" /><div className="mt-2 h-7 w-16 rounded bg-[#f3f2ee] animate-pulse" /></div>)}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="page-container">
      <div className="section-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">{loads.length} total loads · {batchCount} batches · {dueReminders.length} reminders</p>
          </div>
          <div className="flex items-center gap-2">
            {loadError && <span className="text-xs text-red-500">{loadError}</span>}
            <button onClick={fetchAll} disabled={loading} className="btn-secondary">{loading ? 'Loading...' : 'Refresh'}</button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/dispatch" className="kpi-card group">
            <p className="kpi-label">Active Loads</p>
            <p className="kpi-value group-hover:text-amber-600 transition-colors">{currentLoads.length}</p>
            <p className="kpi-sub">{inTransit} in transit</p>
          </Link>
          <div className="kpi-card">
            <p className="kpi-label">Total Profit</p>
            <p className="kpi-value text-emerald-600">+${totalProfit.toLocaleString()}</p>
            <p className="kpi-sub">{delivered} delivered</p>
          </div>
          <Link href="/outreach" className="kpi-card group">
            <p className="kpi-label">Email Batches</p>
            <p className="kpi-value group-hover:text-amber-600 transition-colors">{batchCount}</p>
            <p className="kpi-sub">{prospectsCount} prospects · {customersCount} customers</p>
          </Link>
          <Link href="/follow-ups" className="kpi-card group">
            <p className="kpi-label">Follow-ups</p>
            <p className="kpi-value text-red-500">{todayFollowUps + dueReminders.length}</p>
            <p className="kpi-sub">{todayFollowUps} due · {dueReminders.length} reminders</p>
          </Link>
        </div>

        {/* Due reminders */}
        {dueReminders.length > 0 && (
          <div className="card border-red-200 bg-red-50/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-red-600">Reminders Due</h2>
              <Link href="/follow-ups" className="text-xs text-red-500 hover:text-red-600">View all</Link>
            </div>
            <div className="space-y-2">
              {dueReminders.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-3 border border-red-100">
                  <div>
                    <p className="text-sm font-medium text-[#1a1917]">{r.companyName || r.email}</p>
                    <p className="text-xs text-[#6b6960]">{r.notes || 'Follow up'}</p>
                  </div>
                  <button onClick={async () => {
                    try {
                      const r2 = await fetch('/api/broker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'complete-reminder', reminderId: r.id }) })
                      if (r2.ok) setDueReminders(prev => prev.filter(x => x.id !== r.id))
                    } catch {}
                  }} className="btn-primary text-xs">Done</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/prospects" className="kpi-card group">
            <p className="kpi-label">Prospects</p>
            <p className="kpi-value text-amber-600 group-hover:text-amber-700 transition-colors">{prospectsCount}</p>
            <p className="kpi-sub">interested leads</p>
          </Link>
          <Link href="/customers" className="kpi-card group">
            <p className="kpi-label">Customers</p>
            <p className="kpi-value text-emerald-600 group-hover:text-emerald-700 transition-colors">{customersCount}</p>
            <p className="kpi-sub">active accounts</p>
          </Link>
          <Link href="/carriers" className="kpi-card group">
            <p className="kpi-label">Carriers</p>
            <p className="kpi-value text-blue-600 group-hover:text-blue-700 transition-colors">{carriersCount ?? '—'}</p>
            <p className="kpi-sub">search records</p>
          </Link>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
            className="select w-48">
            <option value="">All Months</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by load#, customer, route, carrier..."
            className="input flex-1" />
        </div>

        {/* Error message for status update */}
        {statusError && <p className="text-xs text-red-500">{statusError}</p>}

        {/* Load table */}
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Load#</th>
                <th>Customer</th>
                <th>Route</th>
                <th>Date</th>
                <th>Carrier</th>
                <th>Status</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Profit</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-[#9a9589]">No loads found</td></tr>
              )}
              {filtered.map(load => (
                <tr key={load.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-[#1a1917]">{load.loadNumber}</span>
                      <span className={`badge ${load.company === 'ST' ? 'badge-blue' : 'badge-amber'}`}>{load.company}</span>
                    </div>
                  </td>
                  <td className="font-medium text-[#1a1917]">{load.customerName}</td>
                  <td className="text-[#6b6960] truncate max-w-[200px]">{load.pickUpLocation} → {load.deliveryLocation}</td>
                  <td className="text-[#9a9589]">{load.pickUpDate}</td>
                  <td className="text-[#6b6960] truncate max-w-[150px]">{load.carrierName || '—'}</td>
                  <td>
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
                      className={`select text-xs py-1 px-2 ${
                        load.status === 'delivered' ? 'badge-green' :
                        load.status === 'paid' ? 'badge-green' :
                        load.status === 'in_transit' ? 'badge-amber' :
                        'badge-gray'
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
                  <td className="text-right font-mono text-sm font-semibold text-amber-600">${load.rate?.toLocaleString()}</td>
                  <td className="text-right font-mono text-sm font-semibold text-emerald-600">+${(load.netCommission ?? 0).toLocaleString()}</td>
                  <td>
                    <Link href={`/loads/${load.id}`} className="btn-ghost text-xs">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
