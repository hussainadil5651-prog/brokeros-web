'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface CarrierRec { carrierName: string; mcNumber: string; lane: string; customerName: string; price: number; loadNumber: string; date: string }

export default function CarriersPage() {
  const { status: authStatus } = useSession()
  const [carriers, setCarriers] = useState<CarrierRec[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addError, setAddError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ carrierName: '', mcNumber: '', lane: '', customerName: '', price: '', loadNumber: '', date: '' })
  const [suggestions, setSuggestions] = useState<{ names: string[]; lanes: string[]; customers: string[] }>({ names: [], lanes: [], customers: [] })

  async function fetchData(q?: string) {
    setLoading(true); setFetchError('')
    try { const url = q ? `/api/broker?type=carriers&q=${encodeURIComponent(q)}` : '/api/broker?type=carriers'; const r = await fetch(url); if (r.ok) setCarriers((await r.json()).carriers ?? []); else setFetchError('Failed to load carriers') }
    catch { setFetchError('Network error — check your connection') } finally { setLoading(false) }
  }

  useEffect(() => { if (authStatus === 'authenticated') fetchData(undefined) }, [authStatus])

  useEffect(() => {
    fetch('/api/loads').then(r => { if (r.ok) r.json().then(d => {
      const loads = d.loads ?? []; const names = [...new Set(loads.map((l: any) => l.carrierName).filter(Boolean))] as string[]; const lanes = [...new Set(loads.map((l: any) => `${l.pickUpLocation} → ${l.deliveryLocation}`).filter((s: string) => s.includes('→')))] as string[]; const customers = [...new Set(loads.map((l: any) => l.customerName).filter(Boolean))] as string[]; setSuggestions({ names, lanes, customers })
    })}).catch(() => {})
  }, [authStatus])

  function handleSearch(val: string) { setSearch(val); if (val.length >= 2) fetchData(val); else if (!val) fetchData(undefined) }

  async function handleAdd() {
    if (!form.carrierName) return; setSaving(true); setAddError('')
    try {
      const r = await fetch('/api/broker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add-carrier', carrierName: form.carrierName, mcNumber: form.mcNumber, lane: form.lane, customerName: form.customerName, price: parseFloat(form.price) || 0, loadNumber: form.loadNumber, date: form.date || new Date().toISOString().split('T')[0] }) })
      if (r.ok) { setForm({ carrierName: '', mcNumber: '', lane: '', customerName: '', price: '', loadNumber: '', date: '' }); setAddOpen(false); await fetchData(undefined) }
      else { const d = await r.json().catch(() => ({})); setAddError(d.error || 'Failed to add carrier') }
    } catch { setAddError('Network error — try again') } finally { setSaving(false) }
  }

  if (authStatus === 'loading' || loading) return <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]"><div className="spinner" /></div>

  const filteredCarriers = search ? carriers.filter(c =>
    (c.carrierName || '').toLowerCase().includes(search.toLowerCase()) || (c.mcNumber || '').toLowerCase().includes(search.toLowerCase()) || (c.lane || '').toLowerCase().includes(search.toLowerCase()) || (c.customerName || '').toLowerCase().includes(search.toLowerCase())
  ) : carriers

  return (
    <main className="page-container">
      <div className="section-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Carriers</h1>
            <p className="page-subtitle">{carriers.length} records · search by MC, lane, carrier, or customer</p>
          </div>
          <button onClick={() => { setAddOpen(true); setAddError('') }} className="btn-primary">+ Add Record</button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <input type="text" value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search by carrier name, MC#, lane, or customer..." className="input max-w-xl" />
        {fetchError && <p className="text-xs text-red-500">{fetchError}</p>}

        <div className="card">
          {filteredCarriers.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-[#9a9589]">
              {search ? 'No carrier records match your search.' : 'No carrier records yet. Add your first one or loads will be imported automatically.'}
            </p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Carrier</th><th>MC#</th><th>Lane</th><th>Customer</th><th className="text-right">Price</th><th>Load#</th><th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCarriers.map((c, i) => (
                    <tr key={i}>
                      <td className="font-medium text-[#1a1917]">{c.carrierName || '—'}</td>
                      <td className="font-mono text-[#9a9589]">{c.mcNumber || '—'}</td>
                      <td className="text-[#6b6960] max-w-[250px] truncate">{c.lane || '—'}</td>
                      <td className="text-[#6b6960]">{c.customerName || '—'}</td>
                      <td className="text-right font-mono text-amber-600">${(c.price ?? 0).toLocaleString()}</td>
                      <td className="text-[#9a9589]">{c.loadNumber || '—'}</td>
                      <td className="text-[#9a9589]">{c.date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {carriers.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="kpi-card"><p className="kpi-label">Unique Carriers</p><p className="kpi-value">{new Set(carriers.map(c => c.carrierName).filter(Boolean)).size}</p></div>
            <div className="kpi-card"><p className="kpi-label">Unique Lanes</p><p className="kpi-value">{new Set(carriers.map(c => c.lane).filter(Boolean)).size}</p></div>
            <div className="kpi-card"><p className="kpi-label">Avg Price</p><p className="kpi-value text-amber-600">${Math.round(carriers.reduce((a, c) => a + (c.price ?? 0), 0) / (carriers.length || 1)).toLocaleString()}</p></div>
          </div>
        )}

        {addOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-xl border border-[#e8e6e1] bg-white p-6 shadow-xl">
              <h2 className="text-base font-semibold text-[#1a1917] mb-4">Add Carrier Record</h2>
              {addError && <p className="mb-3 text-xs text-red-500">{addError}</p>}
              <div className="space-y-3">
                <div className="relative">
                  <input type="text" value={form.carrierName} onChange={e => setForm({ ...form, carrierName: e.target.value })} placeholder="Carrier name *" list="carrier-names" className="input w-full" />
                  <datalist id="carrier-names">{suggestions.names.map(n => <option key={n} value={n} />)}</datalist>
                </div>
                <div className="flex gap-2">
                  <input type="text" value={form.mcNumber} onChange={e => setForm({ ...form, mcNumber: e.target.value })} placeholder="MC#" className="input flex-1" />
                  <input type="text" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="Price" className="input w-24" />
                </div>
                <div className="relative">
                  <input type="text" value={form.lane} onChange={e => setForm({ ...form, lane: e.target.value })} placeholder="Lane (e.g. City → City)" list="carrier-lanes" className="input w-full" />
                  <datalist id="carrier-lanes">{suggestions.lanes.map(n => <option key={n} value={n} />)}</datalist>
                </div>
                <div className="relative">
                  <input type="text" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder="Customer name" list="carrier-customers" className="input w-full" />
                  <datalist id="carrier-customers">{suggestions.customers.map(n => <option key={n} value={n} />)}</datalist>
                </div>
                <div className="flex gap-2">
                  <input type="text" value={form.loadNumber} onChange={e => setForm({ ...form, loadNumber: e.target.value })} placeholder="Load#" className="input flex-1" />
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="input flex-1" />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setAddOpen(false)} disabled={saving} className="btn-secondary disabled:opacity-50">Cancel</button>
                <button onClick={handleAdd} disabled={saving || !form.carrierName} className="btn-primary disabled:opacity-50">{saving ? 'Saving...' : 'Add'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
