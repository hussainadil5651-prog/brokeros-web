'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface LoadDocument { id: string; docType: string; originalName: string; uploadedAt: string; dataUrl: string; fileSize: number }
interface Load { id: string; loadNumber: string; customerName: string; carrierName: string; company: string; pickUpLocation: string; deliveryLocation: string; pickUpDate: string; rate: number; profit: number; netCommission: number; marginPct: number; status: string; invoiceStatus: string }

const STATUS_ORDER = ['quote', 'booked', 'dispatched', 'in_transit', 'delivered', 'invoiced', 'paid']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const STATUS_LABELS: Record<string, string> = { quote: 'Quote', booked: 'Booked', dispatched: 'Dispatched', in_transit: 'In Transit', delivered: 'Delivered', invoiced: 'Invoiced', paid: 'Paid' }
const STATUS_COLORS: Record<string, string> = {
  quote: 'badge-gray', booked: 'badge-amber', dispatched: 'badge-blue',
  in_transit: 'badge-amber', delivered: 'badge-green', invoiced: 'badge-purple', paid: 'badge-green',
}

function monthKey(d: string): string { if (!d) return ''; const date = new Date(d); if (isNaN(date.getTime())) return ''; return `${MONTHS[date.getMonth()]}-${date.getFullYear()}` }
function currentMonth(): string { const n = new Date(); return `${MONTHS[n.getMonth()]}-${n.getFullYear()}` }

export default function DispatchPage() {
  const { data: session, status: authStatus } = useSession()
  const [loads, setLoads] = useState<Load[]>([])
  const [selected, setSelected] = useState<Load | null>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState('')
  const [documents, setDocuments] = useState<LoadDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (authStatus !== 'authenticated') return
    async function fetchLoads() {
      setLoading(true); setFetchError('')
      try { const res = await fetch('/api/loads'); if (res.ok) setLoads((await res.json()).loads ?? []); else setFetchError('Failed to load loads') }
      catch { setFetchError('Network error — check your connection') } finally { setLoading(false) }
    }
    fetchLoads()
  }, [authStatus])

  async function fetchDocuments(loadId: string) {
    try { const res = await fetch(`/api/loads/${loadId}/documents`); if (res.ok) setDocuments((await res.json()).documents ?? []) } catch {}
  }

  useEffect(() => { if (selected) fetchDocuments(selected.id); else setDocuments([]) }, [selected?.id])

  async function handleUpload(file: File, docType: string) {
    if (!selected) return; setUploading(true)
    try { const fd = new FormData(); fd.append('file', file); fd.append('docType', docType); const res = await fetch(`/api/loads/${selected.id}/documents`, { method: 'POST', body: fd }); if (res.ok) await fetchDocuments(selected.id) }
    finally { setUploading(false) }
  }

  const months = [...new Set(loads.map(l => monthKey(l.pickUpDate)).filter(Boolean))].sort()
  const filtered = month ? loads.filter(l => monthKey(l.pickUpDate) === month) : loads
  const activeCount = filtered.filter(l => !['delivered', 'invoiced', 'paid'].includes(l.status)).length
  const totalProfit = filtered.reduce((s, l) => s + l.netCommission, 0)

  async function updateStatus(loadId: string, status: string) {
    const res = await fetch('/api/loads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loadId, status }) })
    if (res.ok) { const data = await res.json(); setLoads(prev => prev.map(l => l.id === loadId ? { ...l, status: data.load.status } : l)); setSelected(prev => prev?.id === loadId ? { ...prev, status: data.load.status } : prev) }
  }

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ customerName: '', pickUpLocation: '', deliveryLocation: '', pickUpDate: '', deliveryDate: '', carrierName: '', rate: '', carrierCost: '', equipmentType: '', company: 'CW' })
  const [creating, setCreating] = useState(false)
  const suggestions = { customers: [...new Set(loads.map(l => l.customerName).filter(Boolean))], lanes: [...new Set(loads.map(l => `${l.pickUpLocation} → ${l.deliveryLocation}`).filter((s: string) => s.includes('→')))], carriers: [...new Set(loads.map(l => l.carrierName).filter(Boolean))], origins: [...new Set(loads.map(l => l.pickUpLocation).filter(Boolean))], destinations: [...new Set(loads.map(l => l.deliveryLocation).filter(Boolean))] }

  async function refreshLoads() {
    setLoading(true); setFetchError('')
    try { const res = await fetch('/api/loads'); if (res.ok) { setLoads((await res.json()).loads ?? []); setFetchError('') } else setFetchError('Failed to refresh loads') } catch { setFetchError('Network error') } finally { setLoading(false) }
  }

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await fetch('/api/loads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerName: createForm.customerName, pickUpLocation: createForm.pickUpLocation, deliveryLocation: createForm.deliveryLocation, pickUpDate: createForm.pickUpDate || undefined, deliveryDate: createForm.deliveryDate || undefined, carrierName: createForm.carrierName || undefined, rate: parseFloat(createForm.rate), carrierCost: createForm.carrierCost ? parseFloat(createForm.carrierCost) : undefined, equipmentType: createForm.equipmentType || undefined, company: createForm.company }) })
      if (res.ok) { setShowCreate(false); setCreateForm({ customerName: '', pickUpLocation: '', deliveryLocation: '', pickUpDate: '', deliveryDate: '', carrierName: '', rate: '', carrierCost: '', equipmentType: '', company: 'CW' }); const data = await res.json(); setLoads(prev => [data.load, ...prev]) }
    } finally { setCreating(false) }
  }

  if (authStatus === 'loading') return <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]"><div className="spinner" /></div>

  return (
    <main className="flex min-h-screen flex-col bg-[#f8f7f4]">
      {/* Header */}
      <div className="border-b border-[#e8e6e1] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Dispatch</h1>
            <p className="page-subtitle">{filtered.length} loads · {activeCount} active · <span className="font-mono text-amber-600">${totalProfit.toLocaleString()}</span>{fetchError && <span className="ml-2 text-red-500">· {fetchError}</span>}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCreate(true)} className="btn-primary">+ New</button>
            <button onClick={refreshLoads} className="btn-secondary">Refresh</button>
            <select value={month} onChange={e => { setMonth(e.target.value); setSelected(null) }}
              className="select">
              <option value="">All Months</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Two-panel */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left: Load list */}
        <div className={`flex flex-col border-b md:border-b-0 md:border-r border-[#e8e6e1] ${selected ? 'md:w-1/2' : 'flex-1'}`}>
          {loading ? (
            <div className="space-y-2 p-4">{[...Array(6)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-[#f3f2ee]" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 items-center justify-center"><p className="text-sm text-[#9a9589]">No loads for {month}</p></div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filtered.map(load => (
                <button key={load.id} onClick={() => setSelected(load)}
                  className={`w-full border-b border-[#e8e6e1] px-6 py-3 text-left transition-all ${selected?.id === load.id ? 'bg-amber-50 border-l-2 border-l-amber-500' : 'hover:bg-[#f3f2ee]'}`}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-[#9a9589]">{load.loadNumber}</span>
                        <span className={`badge ${load.company === 'ST' ? 'badge-blue' : 'badge-amber'}`}>{load.company || 'CW'}</span>
                        <span className={`badge ${STATUS_COLORS[load.status] ?? ''}`}>{STATUS_LABELS[load.status] ?? load.status}</span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-[#1a1917]">{load.customerName}</p>
                      <p className="truncate text-xs text-[#9a9589]">{load.pickUpLocation} → {load.deliveryLocation}</p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="font-mono text-sm font-semibold text-amber-600">${load.rate?.toLocaleString()}</p>
                      <p className="text-[10px] text-[#9a9589]">{load.marginPct}%</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Detail panel */}
        {selected && (
          <div className="flex flex-col md:w-1/2 overflow-y-auto bg-white">
            <div className="border-b border-[#e8e6e1] px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-xs text-[#9a9589]">{selected.loadNumber}</p>
                  <h2 className="text-base font-semibold text-[#1a1917]">{selected.customerName}</h2>
                </div>
                <button onClick={() => setSelected(null)} className="btn-secondary text-[10px]">Close</button>
              </div>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div>
                <p className="kpi-label">Status</p>
                <div className="flex gap-2">
                  {(() => {
                    const idx = STATUS_ORDER.indexOf(selected.status)
                    if (idx === -1 || idx >= STATUS_ORDER.length - 1) return <span className="badge-green flex-1 text-center py-2">✓ {STATUS_LABELS[selected.status]}</span>
                    const next = STATUS_ORDER[idx + 1]
                    return <button onClick={() => updateStatus(selected.id, next)} className="btn-primary flex-1">Advance to {STATUS_LABELS[next]}</button>
                  })()}
                </div>
              </div>
              <div className="card p-4">
                <p className="kpi-label">Route</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-[#9a9589]">Pick-up</span><span className="text-[#1a1917]">{selected.pickUpLocation}</span></div>
                  <div className="flex justify-between"><span className="text-[#9a9589]">Delivery</span><span className="text-[#1a1917]">{selected.deliveryLocation}</span></div>
                  <div className="flex justify-between"><span className="text-[#9a9589]">Date</span><span className="text-[#1a1917]">{selected.pickUpDate || '—'}</span></div>
                </div>
              </div>
              <div className="card p-4">
                <p className="kpi-label">Financials</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-[#9a9589]">Rate</span><span className="font-mono text-amber-600">${selected.rate?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-[#9a9589]">Profit</span><span className="font-mono text-emerald-600 font-semibold">${selected.netCommission?.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-[#9a9589]">Margin</span><span className="font-mono text-[#6b6960]">{selected.marginPct}%</span></div>
                </div>
              </div>
              {selected.carrierName && (
                <div className="card p-4">
                  <p className="kpi-label">Carrier</p>
                  <p className="text-sm text-[#1a1917]">{selected.carrierName}</p>
                </div>
              )}
              <div className="card p-4">
                <p className="kpi-label">Documents</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {['RC', 'BOL', 'POD', 'OTHER'].map(type => (
                    <label key={type} className={`badge cursor-pointer hover:opacity-80 ${type === 'POD' ? 'badge-green' : type === 'BOL' ? 'badge-blue' : type === 'RC' ? 'badge-amber' : 'badge-gray'} ${uploading ? 'opacity-40 pointer-events-none' : ''}`}>
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, type); e.target.value = '' }} />
                      +{type}
                    </label>
                  ))}
                </div>
                {uploading && <p className="text-[10px] text-[#9a9589] mb-2">Uploading...</p>}
                {documents.length === 0 ? (
                  <p className="text-xs text-[#9a9589]">No documents</p>
                ) : (
                  <div className="space-y-1">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between rounded-lg bg-[#f8f7f4] px-3 py-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`badge ${doc.docType === 'POD' ? 'badge-green' : doc.docType === 'BOL' ? 'badge-blue' : doc.docType === 'RC' ? 'badge-amber' : 'badge-gray'}`}>{doc.docType}</span>
                            <span className="text-xs text-[#1a1917] truncate">{doc.originalName}</span>
                          </div>
                          <p className="text-[9px] text-[#9a9589]">{new Date(doc.uploadedAt).toLocaleDateString()}</p>
                        </div>
                        <a href={doc.dataUrl} download={doc.originalName} className="btn-ghost text-[9px]">DL</a>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[#e8e6e1] bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-[#1a1917] mb-4">New Load</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Customer name" value={createForm.customerName} onChange={e => setCreateForm(f => ({ ...f, customerName: e.target.value }))} list="suggest-customers" className="input" />
              <datalist id="suggest-customers">{suggestions.customers.map(c => <option key={c} value={c} />)}</datalist>
              <div className="flex gap-2">
                <input type="text" placeholder="Pick-up" value={createForm.pickUpLocation} onChange={e => setCreateForm(f => ({ ...f, pickUpLocation: e.target.value }))} list="suggest-origins" className="input flex-1" />
                <datalist id="suggest-origins">{suggestions.origins.map(c => <option key={c} value={c} />)}</datalist>
                <input type="text" placeholder="Delivery" value={createForm.deliveryLocation} onChange={e => setCreateForm(f => ({ ...f, deliveryLocation: e.target.value }))} list="suggest-destinations" className="input flex-1" />
                <datalist id="suggest-destinations">{suggestions.destinations.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="flex gap-2">
                <input type="date" value={createForm.pickUpDate} onChange={e => setCreateForm(f => ({ ...f, pickUpDate: e.target.value }))} className="input flex-1" />
                <input type="date" value={createForm.deliveryDate} onChange={e => setCreateForm(f => ({ ...f, deliveryDate: e.target.value }))} className="input flex-1" />
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Carrier name" value={createForm.carrierName} onChange={e => setCreateForm(f => ({ ...f, carrierName: e.target.value }))} list="suggest-carriers" className="input flex-1" />
                <datalist id="suggest-carriers">{suggestions.carriers.map(c => <option key={c} value={c} />)}</datalist>
                <input type="text" placeholder="Equip." value={createForm.equipmentType} onChange={e => setCreateForm(f => ({ ...f, equipmentType: e.target.value }))} className="input w-20" />
              </div>
              <div className="flex gap-2">
                <input type="number" placeholder="Rate" value={createForm.rate} onChange={e => setCreateForm(f => ({ ...f, rate: e.target.value }))} className="input flex-1" />
                <input type="number" placeholder="Carrier cost" value={createForm.carrierCost} onChange={e => setCreateForm(f => ({ ...f, carrierCost: e.target.value }))} className="input flex-1" />
              </div>
              <select value={createForm.company} onChange={e => setCreateForm(f => ({ ...f, company: e.target.value }))} className="select">
                <option value="CW">CW</option><option value="ST">ST</option>
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCreate} disabled={creating || !createForm.customerName || !createForm.pickUpLocation || !createForm.deliveryLocation || !createForm.rate} className="btn-primary disabled:opacity-50">{creating ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
