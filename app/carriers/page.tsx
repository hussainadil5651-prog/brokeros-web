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
    setLoading(true)
    setFetchError('')
    try {
      const url = q ? `/api/broker?type=carriers&q=${encodeURIComponent(q)}` : '/api/broker?type=carriers'
      const r = await fetch(url)
      if (r.ok) setCarriers((await r.json()).carriers ?? [])
      else setFetchError('Failed to load carriers')
    } catch {
      setFetchError('Network error — check your connection')
    } finally { setLoading(false) }
  }

  useEffect(() => { if (authStatus === 'authenticated') fetchData(undefined) }, [authStatus])

  useEffect(() => {
    fetch('/api/loads').then(r => { if (r.ok) r.json().then(d => {
      const loads = d.loads ?? []
      const names = [...new Set(loads.map((l: any) => l.carrierName).filter(Boolean))] as string[]
      const lanes = [...new Set(loads.map((l: any) => `${l.pickUpLocation} → ${l.deliveryLocation}`).filter((s: string) => s.includes('→')))] as string[]
      const customers = [...new Set(loads.map((l: any) => l.customerName).filter(Boolean))] as string[]
      setSuggestions({ names, lanes, customers })
    })}).catch(() => {})
  }, [authStatus])

  function handleSearch(val: string) {
    setSearch(val)
    if (val.length >= 2) fetchData(val)
    else if (!val) fetchData(undefined)
  }

  async function handleAdd() {
    if (!form.carrierName) return
    setSaving(true)
    setAddError('')
    try {
      const r = await fetch('/api/broker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-carrier',
          carrierName: form.carrierName,
          mcNumber: form.mcNumber,
          lane: form.lane,
          customerName: form.customerName,
          price: parseFloat(form.price) || 0,
          loadNumber: form.loadNumber,
          date: form.date || new Date().toISOString().split('T')[0],
        }),
      })
      if (r.ok) {
        setForm({ carrierName: '', mcNumber: '', lane: '', customerName: '', price: '', loadNumber: '', date: '' })
        setAddOpen(false)
        await fetchData(undefined)
      } else {
        const d = await r.json().catch(() => ({}))
        setAddError(d.error || 'Failed to add carrier')
      }
    } catch {
      setAddError('Network error — try again')
    } finally { setSaving(false) }
  }

  if (authStatus === 'loading' || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div>
  }

  const filteredCarriers = search
    ? carriers.filter(c =>
        (c.carrierName || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.mcNumber || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.lane || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.customerName || '').toLowerCase().includes(search.toLowerCase())
      )
    : carriers

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="relative border-b border-white/[0.06] px-6 py-4 before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-gradient-to-r before:from-amber-500 before:to-amber-500/0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Carriers</h1>
            <p className="text-xs text-zinc-600">{carriers.length} records · search by MC, lane, carrier, or customer</p>
          </div>
          <button onClick={() => { setAddOpen(true); setAddError('') }} className="rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 press">+ Add Record</button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <input type="text" value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search by carrier name, MC#, lane, or customer..."
          className="w-full max-w-xl rounded-md border border-white/[0.06] bg-zinc-900/50 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
        {fetchError && <p className="text-xs text-rose-400">{fetchError}</p>}

        <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50">
          {filteredCarriers.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-zinc-700">
              {search ? 'No carrier records match your search.' : 'No carrier records yet. Add your first one or loads will be imported automatically.'}
            </p>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3">Carrier</th>
                    <th className="px-4 py-3">MC#</th>
                    <th className="px-4 py-3">Lane</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3">Load#</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCarriers.map((c, i) => (
                    <tr key={i} className="border-b border-white/[0.04] transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium text-zinc-200">{c.carrierName || '—'}</td>
                      <td className="px-4 py-3 font-mono text-zinc-500">{c.mcNumber || '—'}</td>
                      <td className="px-4 py-3 text-zinc-400 max-w-[250px] truncate">{c.lane || '—'}</td>
                      <td className="px-4 py-3 text-zinc-400">{c.customerName || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-400">${(c.price ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-zinc-600">{c.loadNumber || '—'}</td>
                      <td className="px-4 py-3 text-zinc-600">{c.date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick stats */}
        {carriers.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-4">
              <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Unique Carriers</p>
              <p className="mt-1 font-mono text-2xl font-bold text-zinc-100">{new Set(carriers.map(c => c.carrierName).filter(Boolean)).size}</p>
            </div>
            <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-4">
              <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Unique Lanes</p>
              <p className="mt-1 font-mono text-2xl font-bold text-zinc-100">{new Set(carriers.map(c => c.lane).filter(Boolean)).size}</p>
            </div>
            <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-4">
              <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Avg Price</p>
              <p className="mt-1 font-mono text-2xl font-bold text-amber-400">${Math.round(carriers.reduce((a, c) => a + (c.price ?? 0), 0) / (carriers.length || 1)).toLocaleString()}</p>
            </div>
          </div>
        )}

        {addOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg rounded-lg border border-white/[0.06] bg-zinc-900 p-6 overlay">
              <h2 className="text-base font-semibold text-zinc-100 mb-4">Add Carrier Record</h2>
              {addError && <p className="mb-3 text-xs text-rose-400">{addError}</p>}
              <div className="space-y-3">
                <div className="relative">
                  <input type="text" value={form.carrierName} onChange={e => setForm({ ...form, carrierName: e.target.value })} placeholder="Carrier name *"
                    list="carrier-names"
                    className="w-full rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                  <datalist id="carrier-names">{suggestions.names.map(n => <option key={n} value={n} />)}</datalist>
                </div>
                <div className="flex gap-2">
                  <input type="text" value={form.mcNumber} onChange={e => setForm({ ...form, mcNumber: e.target.value })} placeholder="MC#"
                    className="flex-1 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                  <input type="text" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="Price"
                    className="w-24 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                </div>
                <div className="relative">
                  <input type="text" value={form.lane} onChange={e => setForm({ ...form, lane: e.target.value })} placeholder="Lane (e.g. City → City)"
                    list="carrier-lanes"
                    className="w-full rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                  <datalist id="carrier-lanes">{suggestions.lanes.map(n => <option key={n} value={n} />)}</datalist>
                </div>
                <div className="relative">
                  <input type="text" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder="Customer name"
                    list="carrier-customers"
                    className="w-full rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                  <datalist id="carrier-customers">{suggestions.customers.map(n => <option key={n} value={n} />)}</datalist>
                </div>
                <div className="flex gap-2">
                  <input type="text" value={form.loadNumber} onChange={e => setForm({ ...form, loadNumber: e.target.value })} placeholder="Load#"
                    className="flex-1 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    className="flex-1 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-500/30" />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setAddOpen(false)} disabled={saving} className="rounded-md px-4 py-2 text-xs text-zinc-600 hover:text-zinc-400 press disabled:opacity-50">Cancel</button>
                <button onClick={handleAdd} disabled={saving || !form.carrierName}
                  className="rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 press disabled:opacity-50">
                  {saving ? 'Saving...' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
