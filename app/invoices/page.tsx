'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/components/toast'

interface Invoice { id: string; invoiceNumber: string; loadNumber: string; customerName: string; amount: number; status: string; expectedPayout: number; payoutDate: string | null; payoutStatus: string; createdAt: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ACTUAL_PAYOUT_KEY = 'afa-actual-payouts'

function monthKey(d: string): string { if (!d) return ''; const date = new Date(d); if (isNaN(date.getTime())) return ''; return `${MONTHS[date.getMonth()]}-${date.getFullYear()}` }
function currentMonthKey(): string { const n = new Date(); return `${MONTHS[n.getMonth()]}-${n.getFullYear()}` }
function getActualPayouts(): Record<string, number> { if (typeof window === 'undefined') return {}; try { return JSON.parse(localStorage.getItem(ACTUAL_PAYOUT_KEY) || '{}') } catch { return {} } }
function saveActualPayout(invoiceId: string, amount: number) { const current = getActualPayouts(); current[invoiceId] = amount; localStorage.setItem(ACTUAL_PAYOUT_KEY, JSON.stringify(current)) }

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
    setLoading(true); setFetchError('')
    try {
      const results = await Promise.allSettled([fetch('/api/invoices'), fetch('/api/invoices?scope=forecast')])
      if (results[0].status === 'fulfilled' && results[0].value.ok) setInvoices((await results[0].value.json()).invoices ?? [])
      if (results[1].status === 'fulfilled' && results[1].value.ok) setForecast((await results[1].value.json()).forecast)
    } catch { setFetchError('Failed to load invoice data') } finally { setLoading(false) }
  }

  useEffect(() => { if (authStatus === 'authenticated') fetchAll() }, [authStatus])

  async function markCleared(invoiceId: string) {
    setSavingId(invoiceId)
    try { const res = await fetch('/api/invoices', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId, paidDate: new Date().toISOString().split('T')[0] }) }); if (res.ok) { await fetchAll(); toast('Invoice cleared successfully', 'success') } else toast('Failed to clear invoice', 'error') }
    catch { toast('Failed to clear invoice', 'error') } finally { setSavingId(null) }
  }

  const months = [...new Set(invoices.map(i => monthKey(i.createdAt)).filter(Boolean))].sort()
  const filtered = monthFilter ? invoices.filter(i => monthKey(i.createdAt) === monthFilter) : invoices
  const actualPayouts = getActualPayouts()
  const totalActual = Object.values(actualPayouts).reduce((s, v) => s + v, 0)

  if (authStatus === 'loading' || loading) return <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]"><div className="spinner" /></div>

  const paid = filtered.filter(i => i.status === 'paid')
  const unpaid = filtered.filter(i => i.status !== 'paid')
  const filteredTotal = filtered.reduce((s, i) => s + i.expectedPayout, 0)

  return (
    <main className="page-container">
      <div className="section-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Invoices</h1>
            <p className="page-subtitle">{filtered.length} invoices · {paid.length} cleared · {unpaid.length} pending</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={months.includes(monthFilter) ? monthFilter : ''} onChange={e => setMonthFilter(e.target.value || currentMonthKey())} className="select">
              {months.length === 0 && <option value="">No data</option>}
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={() => fetchAll()} className="btn-secondary">Refresh</button>
            {fetchError && <span className="text-[10px] text-red-500">{fetchError}</span>}
          </div>
        </div>
      </div>
      <div className="p-6 space-y-6">
        {forecast && (
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="kpi-card"><p className="kpi-label">Next Payout</p><p className="kpi-value text-amber-600">${(forecast.nextPayoutAmount ?? 0).toLocaleString()}</p><p className="kpi-sub">{forecast.nextPayoutDate} · est. 65%</p></div>
            <div className="kpi-card"><p className="kpi-label">Est. Pending</p><p className="kpi-value">${(forecast.totalExpected ?? 0).toLocaleString()}</p><p className="kpi-sub">{forecast.pendingCount} pending</p></div>
            <div className="kpi-card"><p className="kpi-label">Invoice Cleared</p><p className="kpi-value text-emerald-600">${totalActual > 0 ? totalActual.toLocaleString() : (forecast.totalPaid ?? 0).toLocaleString()}</p><p className="kpi-sub">{forecast.paidCount} cleared</p></div>
            <div className="kpi-card"><p className="kpi-label">{monthFilter}</p><p className="kpi-value">${filteredTotal.toLocaleString()}</p><p className="kpi-sub">{paid.length}/{filtered.length} cleared</p></div>
          </div>
        )}

        <div className="card">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th><th>Load</th><th>Customer</th><th className="text-right">Amount</th><th className="text-right">Est. Payout</th><th className="text-right">Actual Payout</th><th>Status</th><th>Payout Date</th><th />
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const actual = actualPayouts[inv.id]
                  return (
                    <tr key={inv.id}>
                      <td className="font-mono text-[#9a9589]">{inv.invoiceNumber}</td>
                      <td className="font-mono text-[#9a9589]">{inv.loadNumber}</td>
                      <td className="text-[#1a1917]">{inv.customerName}</td>
                      <td className="text-right font-mono text-amber-600">${inv.amount?.toLocaleString()}</td>
                      <td className="text-right font-mono text-[#6b6960]">${inv.expectedPayout?.toLocaleString()}</td>
                      <td className="text-right">
                        {editingPayout === inv.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <input type="number" value={payoutInputs[inv.id] ?? ''} onChange={e => setPayoutInputs(p => ({ ...p, [inv.id]: e.target.value }))}
                              className="input w-20 text-right py-0.5" autoFocus onKeyDown={e => { if (e.key === 'Enter') { saveActualPayout(inv.id, parseFloat(payoutInputs[inv.id] || '0')); setEditingPayout(null) } if (e.key === 'Escape') setEditingPayout(null) }} />
                            <button onClick={() => setEditingPayout(null)} className="text-[9px] text-[#9a9589]">X</button>
                          </div>
                        ) : (
                          <span className={`font-mono cursor-pointer ${actual ? 'text-emerald-600 font-semibold' : 'text-[#9a9589]'}`}
                            onClick={() => { setEditingPayout(inv.id); setPayoutInputs(p => ({ ...p, [inv.id]: String(actual ?? '') })) }}>
                            {actual ? `$${actual.toLocaleString()}` : '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${inv.status === 'paid' ? 'badge-green' : 'badge-gray'}`}>
                          {inv.status === 'paid' ? 'Cleared' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="text-[#9a9589]">{inv.payoutDate || '—'}</td>
                      <td>
                        {inv.status !== 'paid' ? (
                          <button onClick={() => markCleared(inv.id)} disabled={savingId === inv.id} className="btn-primary text-[10px] disabled:opacity-40">
                            {savingId === inv.id ? '...' : 'Cleared'}
                          </button>
                        ) : <span className="text-[10px] text-emerald-500">✓</span>}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-[#9a9589]">No invoices for {monthFilter}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
