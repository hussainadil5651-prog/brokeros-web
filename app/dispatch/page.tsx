'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface LoadDocument {
  id: string; docType: string; originalName: string; uploadedAt: string; dataUrl: string; fileSize: number
}

interface Load {
  id: string; loadNumber: string; customerName: string; carrierName: string; company: string
  pickUpLocation: string; deliveryLocation: string; pickUpDate: string
  rate: number; profit: number; marginPct: number; status: string; invoiceStatus: string
}

const STATUS_ORDER = ['quote', 'booked', 'dispatched', 'in_transit', 'delivered', 'invoiced', 'paid']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const STATUS_LABELS: Record<string, string> = { quote: 'Quote', booked: 'Booked', dispatched: 'Dispatched', in_transit: 'In Transit', delivered: 'Delivered', invoiced: 'Invoiced', paid: 'Paid' }
const STATUS_COLORS: Record<string, string> = {
  quote: 'bg-zinc-600/40 text-zinc-400 border-zinc-600/50', booked: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  dispatched: 'bg-blue-500/15 text-blue-400 border-blue-500/40', in_transit: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  delivered: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/50', invoiced: 'bg-violet-500/15 text-violet-400 border-violet-500/40',
  paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/50',
}

function monthKey(d: string): string {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return `${MONTHS[date.getMonth()]}-${date.getFullYear()}`
}

function currentMonth(): string {
  const n = new Date()
  return `${MONTHS[n.getMonth()]}-${n.getFullYear()}`
}

export default function DispatchPage() {
  const { data: session, status: authStatus } = useSession()
  const [loads, setLoads] = useState<Load[]>([])
  const [selected, setSelected] = useState<Load | null>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonth())
  const [documents, setDocuments] = useState<LoadDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (authStatus !== 'authenticated') return
    async function fetchLoads() {
      setLoading(true)
      setFetchError('')
      try {
        const res = await fetch('/api/loads')
        if (res.ok) setLoads((await res.json()).loads ?? [])
        else setFetchError('Failed to load loads')
      } catch { setFetchError('Network error — check your connection') } finally { setLoading(false) }
    }
    fetchLoads()
  }, [authStatus])

  async function fetchDocuments(loadId: string) {
    try {
      const res = await fetch(`/api/loads/${loadId}/documents`)
      if (res.ok) setDocuments((await res.json()).documents ?? [])
    } catch {}
  }

  useEffect(() => {
    if (selected) fetchDocuments(selected.id)
    else setDocuments([])
  }, [selected?.id])

  async function handleUpload(file: File, docType: string) {
    if (!selected) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('docType', docType)
      const res = await fetch(`/api/loads/${selected.id}/documents`, { method: 'POST', body: fd })
      if (res.ok) await fetchDocuments(selected.id)
    } finally { setUploading(false) }
  }

  const months = [...new Set(loads.map(l => monthKey(l.pickUpDate)).filter(Boolean))].sort()
  const filtered = loads.filter(l => monthKey(l.pickUpDate) === month)
  const activeCount = filtered.filter(l => !['delivered', 'invoiced', 'paid'].includes(l.status)).length
  const totalProfit = filtered.reduce((s, l) => s + l.profit, 0)

  async function updateStatus(loadId: string, status: string) {
    const res = await fetch('/api/loads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loadId, status }),
    })
    if (res.ok) {
      const data = await res.json()
      setLoads(prev => prev.map(l => l.id === loadId ? { ...l, status: data.load.status } : l))
      setSelected(prev => prev?.id === loadId ? { ...prev, status: data.load.status } : prev)
    }
  }

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ customerName: '', pickUpLocation: '', deliveryLocation: '', pickUpDate: '', deliveryDate: '', carrierName: '', rate: '', carrierCost: '', equipmentType: '', company: 'CW' })
  const [creating, setCreating] = useState(false)
  const suggestions = {
    customers: [...new Set(loads.map(l => l.customerName).filter(Boolean))],
    lanes: [...new Set(loads.map(l => `${l.pickUpLocation} → ${l.deliveryLocation}`).filter((s: string) => s.includes('→')))],
    carriers: [...new Set(loads.map(l => l.carrierName).filter(Boolean))],
    origins: [...new Set(loads.map(l => l.pickUpLocation).filter(Boolean))],
    destinations: [...new Set(loads.map(l => l.deliveryLocation).filter(Boolean))],
  }

  async function refreshLoads() {
    setLoading(true)
    setFetchError('')
    try { const res = await fetch('/api/loads'); if (res.ok) { setLoads((await res.json()).loads ?? []); setFetchError('') } else setFetchError('Failed to refresh loads') } catch { setFetchError('Network error') } finally { setLoading(false) }
  }

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await fetch('/api/loads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: createForm.customerName, pickUpLocation: createForm.pickUpLocation,
          deliveryLocation: createForm.deliveryLocation, pickUpDate: createForm.pickUpDate || undefined,
          deliveryDate: createForm.deliveryDate || undefined, carrierName: createForm.carrierName || undefined,
          rate: parseFloat(createForm.rate), carrierCost: createForm.carrierCost ? parseFloat(createForm.carrierCost) : undefined,
          equipmentType: createForm.equipmentType || undefined, company: createForm.company,
        }),
      })
      if (res.ok) {
        setShowCreate(false)
        setCreateForm({ customerName: '', pickUpLocation: '', deliveryLocation: '', pickUpDate: '', deliveryDate: '', carrierName: '', rate: '', carrierCost: '', equipmentType: '', company: 'CW' })
        const data = await res.json()
        setLoads(prev => [data.load, ...prev])
      }
    } finally { setCreating(false) }
  }

  if (authStatus === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
    </div>
  }

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950">
      {/* Header */}
      <div className="relative flex items-center justify-between border-b border-white/[0.06] px-6 py-4 before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-gradient-to-r before:from-amber-500 before:to-amber-500/0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Dispatch</h1>
          <p className="text-xs text-zinc-600">{filtered.length} loads · {activeCount} active · <span className="font-mono text-amber-400">${totalProfit.toLocaleString()}</span>{fetchError && <span className="ml-2 text-rose-400">· {fetchError}</span>}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 press">+ New</button>
          <button onClick={refreshLoads}
            className="rounded-md border border-white/[0.06] px-3 py-1.5 text-xs text-zinc-500 transition hover:bg-white/[0.03] press">Refresh</button>
          <select value={months.includes(month) ? month : ''} onChange={e => { setMonth(e.target.value || currentMonth()); setSelected(null) }}
            className="rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 outline-none transition focus:border-amber-500/30">
            {months.length === 0 && <option value="">No data</option>}
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Two-panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Load list */}
        <div className={`flex flex-col border-r border-white/[0.06] ${selected ? 'w-1/2' : 'flex-1'}`}>
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(6)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-md bg-zinc-800/50" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-zinc-700">No loads for {month}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {filtered.map(load => (
                <button key={load.id} onClick={() => setSelected(load)}
                  className={`w-full border-b border-white/[0.04] px-6 py-3 text-left transition press ${
                    selected?.id === load.id ? 'bg-amber-500/5' : 'hover:bg-white/[0.02]'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-zinc-600">{load.loadNumber}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[8px] font-mono font-semibold tracking-wider ${
                          load.company === 'ST' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>{load.company || 'CW'}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${STATUS_COLORS[load.status] ?? ''}`}>
                          {STATUS_LABELS[load.status] ?? load.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-zinc-300">{load.customerName}</p>
                      <p className="truncate text-xs text-zinc-600">{load.pickUpLocation} → {load.deliveryLocation}</p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="font-mono text-sm font-semibold text-amber-400">${load.rate?.toLocaleString()}</p>
                      <p className="text-[10px] text-zinc-600">{load.marginPct}%</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Detail panel */}
        {selected && (
          <div className="flex w-1/2 flex-col overflow-y-auto scrollbar-thin bg-zinc-950/50">
            <div className="border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-xs text-zinc-500">{selected.loadNumber}</p>
                  <h2 className="text-base font-semibold text-zinc-100">{selected.customerName}</h2>
                </div>
                <button onClick={() => setSelected(null)} className="rounded border border-white/[0.06] px-2 py-1 text-[10px] kinetic press">Close</button>
              </div>
            </div>

            <div className="space-y-4 px-6 py-4">
              {/* Status */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Status</p>
                <div className="flex gap-2">
                  {(() => {
                    const idx = STATUS_ORDER.indexOf(selected.status)
                    if (idx === -1 || idx >= STATUS_ORDER.length - 1) return <span className="flex-1 rounded-md bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">✓ {STATUS_LABELS[selected.status]}</span>
                    const next = STATUS_ORDER[idx + 1]
                    return (
                      <button onClick={() => updateStatus(selected.id, next)} className="flex-1 rounded-md bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400 transition hover:bg-amber-500/20 press">
                        Advance to {STATUS_LABELS[next]}
                      </button>
                    )
                  })()}
                </div>
              </div>

              {/* Route */}
              <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-4">
                <p className="mb-2 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Route</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-zinc-600">Pick-up</span><span className="text-zinc-300">{selected.pickUpLocation}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">Delivery</span><span className="text-zinc-300">{selected.deliveryLocation}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">Date</span><span className="text-zinc-300">{selected.pickUpDate || '—'}</span></div>
                </div>
              </div>

              {/* Financials */}
              <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-4">
                <p className="mb-2 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Financials</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-zinc-600">Rate</span><span className="font-mono text-amber-400">${selected.rate?.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">Profit</span><span className="font-mono text-amber-300 font-semibold">${selected.profit?.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">Margin</span><span className="font-mono text-zinc-500">{selected.marginPct}%</span></div>
                </div>
              </div>

              {/* Carrier */}
              {selected.carrierName && (
                <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-4">
                  <p className="mb-2 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Carrier</p>
                  <p className="text-sm text-zinc-300">{selected.carrierName}</p>
                </div>
              )}

              {/* Missing Documents */}
              {(() => {
                const hasRC = documents.some(d => d.docType === 'RC')
                const hasBOL = documents.some(d => d.docType === 'BOL')
                const hasPOD = documents.some(d => d.docType === 'POD')
                const isDelivered = selected.status === 'delivered'
                const missing: string[] = []
                if (!hasRC) missing.push('Rate Confirmation (RC)')
                if (isDelivered && !hasPOD) missing.push('Proof of Delivery (POD)')
                if (missing.length === 0) return null
                return (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="mb-1 text-[10px] font-semibold tracking-wider text-amber-400 uppercase">Required</p>
                    {missing.map(m => <p key={m} className="text-xs text-zinc-400">Upload {m}</p>)}
                  </div>
                )
              })()}

              {/* Documents */}
              <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-4">
                <p className="mb-2 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Documents</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {['RC', 'BOL', 'POD', 'OTHER'].map(type => (
                    <label key={type}
                      className={`rounded-md border px-2.5 py-1 text-[10px] font-medium cursor-pointer transition press ${
                        type === 'POD' ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' :
                        type === 'BOL' ? 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10' :
                        type === 'RC' ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10' :
                        'border-zinc-600/50 text-zinc-400 hover:bg-zinc-800'
                      } ${uploading ? 'opacity-40 pointer-events-none' : ''}`}>
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, type); e.target.value = '' }} />
                      +{type}
                    </label>
                  ))}
                </div>
                {uploading && <p className="text-[10px] text-zinc-600 mb-2">Uploading...</p>}
                {documents.length === 0 ? (
                  <p className="text-xs text-zinc-700">No documents</p>
                ) : (
                  <div className="space-y-1">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between rounded bg-zinc-950/50 px-3 py-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-medium ${
                              doc.docType === 'POD' ? 'bg-emerald-500/10 text-emerald-400' :
                              doc.docType === 'BOL' ? 'bg-blue-500/10 text-blue-400' :
                              doc.docType === 'RC' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-zinc-600/30 text-zinc-500'
                            }`}>{doc.docType}</span>
                            <span className="text-xs text-zinc-400 truncate">{doc.originalName}</span>
                          </div>
                          <p className="text-[9px] text-zinc-700">{new Date(doc.uploadedAt).toLocaleDateString()}</p>
                        </div>
                        <a href={doc.dataUrl} download={doc.originalName}
                          className="rounded border border-white/[0.06] px-2 py-0.5 text-[9px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] press">DL</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Load Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-white/[0.06] bg-zinc-900 p-6 overlay">
            <h2 className="text-base font-semibold tracking-tight text-zinc-100 mb-4">New Load</h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input type="text" placeholder="Customer name" value={createForm.customerName} onChange={e => setCreateForm(f => ({ ...f, customerName: e.target.value }))}
                  list="suggest-customers"
                  className="flex-1 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                <datalist id="suggest-customers">{suggestions.customers.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Pick-up" value={createForm.pickUpLocation} onChange={e => setCreateForm(f => ({ ...f, pickUpLocation: e.target.value }))}
                  list="suggest-origins"
                  className="flex-1 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                <datalist id="suggest-origins">{suggestions.origins.map(c => <option key={c} value={c} />)}</datalist>
                <input type="text" placeholder="Delivery" value={createForm.deliveryLocation} onChange={e => setCreateForm(f => ({ ...f, deliveryLocation: e.target.value }))}
                  list="suggest-destinations"
                  className="flex-1 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                <datalist id="suggest-destinations">{suggestions.destinations.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="flex gap-2">
                <input type="date" value={createForm.pickUpDate} onChange={e => setCreateForm(f => ({ ...f, pickUpDate: e.target.value }))}
                  className="flex-1 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none transition focus:border-amber-500/30" />
                <input type="date" value={createForm.deliveryDate} onChange={e => setCreateForm(f => ({ ...f, deliveryDate: e.target.value }))}
                  className="flex-1 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none transition focus:border-amber-500/30" />
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Carrier name" value={createForm.carrierName} onChange={e => setCreateForm(f => ({ ...f, carrierName: e.target.value }))}
                  list="suggest-carriers"
                  className="flex-1 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                <datalist id="suggest-carriers">{suggestions.carriers.map(c => <option key={c} value={c} />)}</datalist>
                <input type="text" placeholder="Equip." value={createForm.equipmentType} onChange={e => setCreateForm(f => ({ ...f, equipmentType: e.target.value }))}
                  className="w-20 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
              </div>
              <div className="flex gap-2">
                <input type="number" placeholder="Rate" value={createForm.rate} onChange={e => setCreateForm(f => ({ ...f, rate: e.target.value }))}
                  className="flex-1 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                <input type="number" placeholder="Carrier cost" value={createForm.carrierCost} onChange={e => setCreateForm(f => ({ ...f, carrierCost: e.target.value }))}
                  className="flex-1 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
              </div>
              <div className="flex gap-2">
                <select value={createForm.company} onChange={e => setCreateForm(f => ({ ...f, company: e.target.value }))}
                  className="rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none transition focus:border-amber-500/30">
                  <option value="CW">CW</option><option value="ST">ST</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="rounded-md border border-white/[0.06] px-4 py-2 text-xs text-zinc-500 transition hover:bg-white/[0.03] press">Cancel</button>
              <button onClick={handleCreate} disabled={creating || !createForm.customerName || !createForm.pickUpLocation || !createForm.deliveryLocation || !createForm.rate}
                className="rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 press disabled:opacity-50">
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
