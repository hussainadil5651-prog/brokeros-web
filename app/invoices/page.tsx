'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/components/toast'

interface Invoice {
  id: string; invoiceNumber: string; loadNumber: string; customerName: string
  amount: number; status: string; expectedPayout: number; payoutDate: string | null; payoutStatus: string; createdAt: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ACTUAL_PAYOUT_KEY = 'afa-actual-payouts'

function monthKey(d: string): string {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return `${MONTHS[date.getMonth()]}-${date.getFullYear()}`
}

function currentMonthKey(): string {
  const n = new Date()
  return `${MONTHS[n.getMonth()]}-${n.getFullYear()}`
}

function getActualPayouts(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(ACTUAL_PAYOUT_KEY) || '{}') } catch { return {} }
}

function saveActualPayout(invoiceId: string, amount: number) {
  const current = getActualPayouts()
  current[invoiceId] = amount
  localStorage.setItem(ACTUAL_PAYOUT_KEY, JSON.stringify(current))
}

export default function InvoicesPage() {
  const { toast } = useToast()
  const { status: authStatus } = useSession()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [forecast, setForecast] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editingPayout, setEditingPayout] = useState<string | null>(null)
  const [payoutInputs, setPayoutInputs] = useState<Record<string, string>>({})
  const [monthFilter, setMonthFilter] = useState(currentMonthKey())
  const [fetchError, setFetchError] = useState('')

  async function fetchAll() {
    setLoading(true)
    setFetchError('')
    try {
      const results = await Promise.allSettled([
        fetch('/api/invoices'),
        fetch('/api/invoices?scope=forecast'),
      ])
      if (results[0].status === 'fulfilled' && results[0].value.ok) setInvoices((await results[0].value.json()).invoices ?? [])
      if (results[1].status === 'fulfilled' && results[1].value.ok) setForecast((await results[1].value.json()).forecast)
    } catch { setFetchError('Failed to load invoice data') } finally { setLoading(false) }
  }

  useEffect(() => { if (authStatus === 'authenticated') fetchAll() }, [authStatus])

  async function markCleared(invoiceId: string) {
    setSavingId(invoiceId)
    try {
      const res = await fetch('/api/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, paidDate: new Date().toISOString().split('T')[0] }),
      })
      if (res.ok) {
        await fetchAll()
        toast('Invoice cleared successfully', 'success')
      } else {
        toast('Failed to clear invoice', 'error')
      }
    } catch { toast('Failed to clear invoice', 'error') } finally { setSavingId(null) }
  }

  const months = [...new Set(invoices.map(i => monthKey(i.createdAt)).filter(Boolean))].sort()
  const filtered = monthFilter ? invoices.filter(i => monthKey(i.createdAt) === monthFilter) : invoices
  const actualPayouts = getActualPayouts()
  const totalActual = Object.values(actualPayouts).reduce((s, v) => s + v, 0)

  if (authStatus === 'loading' || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div>
  }

  const paid = filtered.filter(i => i.status === 'paid')
  const unpaid = filtered.filter(i => i.status !== 'paid')
  const filteredTotal = filtered.reduce((s, i) => s + i.expectedPayout, 0)
  const filteredPaid = paid.reduce((s, i) => s + i.expectedPayout, 0)

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="relative border-b border-white/[0.06] px-6 py-4 before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-gradient-to-r before:from-amber-500 before:to-amber-500/0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Invoices</h1>
            <p className="text-xs text-zinc-600">{filtered.length} invoices · {paid.length} cleared · {unpaid.length} pending</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={months.includes(monthFilter) ? monthFilter : ''} onChange={e => setMonthFilter(e.target.value || currentMonthKey())}
              className="rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 outline-none transition focus:border-amber-500/30">
              {months.length === 0 && <option value="">No data</option>}
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={() => fetchAll()}
              className="rounded-md border border-white/[0.06] px-3 py-1.5 text-xs text-zinc-500 transition hover:bg-white/[0.03] press">Refresh</button>
            {fetchError && <span className="text-[10px] text-rose-400">{fetchError}</span>}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {forecast && (
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900 p-4">
              <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Next Payout</p>
              <p className="mt-2 font-mono text-2xl font-bold text-amber-400">${(forecast.nextPayoutAmount ?? 0).toLocaleString()}</p>
              <p className="mt-1 text-xs text-zinc-600">{forecast.nextPayoutDate} · est. 65%</p>
            </div>
            <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900 p-4">
              <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Est. Pending</p>
              <p className="mt-2 font-mono text-2xl font-bold text-zinc-100">${(forecast.totalExpected ?? 0).toLocaleString()}</p>
              <p className="mt-1 text-xs text-zinc-600">{forecast.pendingCount} pending</p>
            </div>
            <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900 p-4">
              <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Invoice Cleared</p>
              <p className="mt-2 font-mono text-2xl font-bold text-emerald-400">${totalActual > 0 ? totalActual.toLocaleString() : (forecast.totalPaid ?? 0).toLocaleString()}</p>
              <p className="mt-1 text-xs text-zinc-600">{forecast.paidCount} cleared</p>
            </div>
            <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900 p-4">
              <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">{monthFilter}</p>
              <p className="mt-2 font-mono text-2xl font-bold text-zinc-100">${filteredTotal.toLocaleString()}</p>
              <p className="mt-1 text-xs text-zinc-600">{paid.length}/{filtered.length} cleared</p>
            </div>
          </div>
        )}

        <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Load</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Est. Payout</th>
                  <th className="px-4 py-3 text-right">Actual Payout</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payout Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const actual = actualPayouts[inv.id]
                  return (
                    <tr key={inv.id} className="border-b border-white/[0.04] transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-zinc-500">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 font-mono text-zinc-600">{inv.loadNumber}</td>
                      <td className="px-4 py-3 text-zinc-300">{inv.customerName}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-400">${inv.amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-500">${inv.expectedPayout?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        {editingPayout === inv.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <input type="number" value={payoutInputs[inv.id] ?? ''} onChange={e => setPayoutInputs(p => ({ ...p, [inv.id]: e.target.value }))}
                              className="w-20 rounded border border-amber-500/30 bg-zinc-950 px-2 py-0.5 text-right text-xs text-zinc-100 outline-none"
                              autoFocus onKeyDown={e => { if (e.key === 'Enter') { saveActualPayout(inv.id, parseFloat(payoutInputs[inv.id] || '0')); setEditingPayout(null) } if (e.key === 'Escape') setEditingPayout(null) }} />
                            <button onClick={() => setEditingPayout(null)} className="text-[9px] text-zinc-600 press">X</button>
                          </div>
                        ) : (
                          <span className={`font-mono cursor-pointer ${actual ? 'text-emerald-400 font-semibold' : 'text-zinc-700'}`}
                            onClick={() => { setEditingPayout(inv.id); setPayoutInputs(p => ({ ...p, [inv.id]: String(actual ?? '') })) }}>
                            {actual ? `$${actual.toLocaleString()}` : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-zinc-600/50 text-zinc-400 border-zinc-600/50'
                        }`}>
                          {inv.status === 'paid' ? 'Cleared' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{inv.payoutDate || '—'}</td>
                      <td className="px-4 py-3">
                        {inv.status !== 'paid' ? (
                          <button onClick={() => markCleared(inv.id)} disabled={savingId === inv.id}
                            className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400 transition hover:bg-emerald-500/20 press disabled:opacity-40">
                            {savingId === inv.id ? '...' : 'Cleared'}
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-500/50">✓</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-700">No invoices for {monthFilter}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
