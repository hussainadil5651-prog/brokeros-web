'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'

interface Load { id: string; loadNumber: string; customerName: string; carrierName: string; pickUpLocation: string; deliveryLocation: string; pickUpDate: string; deliveryDate: string; rate: number; carrierCost: number; profit: number; netCommission: number; marginPct: number; status: string; company: string; notes: string; invoiceStatus: string }

export default function LoadDetailPage() {
  const { data: session, status: authStatus } = useSession()
  const params = useParams(); const router = useRouter()
  const [load, setLoad] = useState<Load | null>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  async function fetchLoad() { try { const r = await fetch(`/api/loads?id=${params.loadId}`); if (r.ok) setLoad((await r.json()).load ?? null) } catch {} finally { setLoading(false) } }
  async function fetchDocuments() { try { const r = await fetch(`/api/documents?loadNumber=${params.loadId}`); if (r.ok) setDocuments((await r.json()).documents ?? []) } catch {} }

  useEffect(() => { if (authStatus === 'authenticated') { fetchLoad(); fetchDocuments() } }, [params.loadId, authStatus])

  async function handleUpload(file: File, docType: string) {
    if (!load) return; setUploading(true)
    try { const reader = new FileReader(); reader.onload = async () => { const dataUrl = reader.result as string; await fetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loadNumber: load.id, customerName: load.customerName, docType, fileName: file.name, notes: '', fileRef: dataUrl }) }); await fetchDocuments() }; reader.readAsDataURL(file) }
    finally { setUploading(false) }
  }

  if (authStatus === 'loading' || loading) return <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]"><div className="spinner" /></div>
  if (!load) return <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]"><p className="text-[#9a9589]">Load not found</p></div>

  return (
    <main className="min-h-screen bg-[#f8f7f4]">
      <div className="border-b border-[#e8e6e1] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-sm text-[#9a9589] hover:text-[#1a1917]">&larr;</button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight text-[#1a1917]">{load.loadNumber}</h1>
                <span className={`badge ${load.company === 'ST' ? 'badge-blue' : 'badge-amber'}`}>{load.company}</span>
              </div>
              <p className="text-xs text-[#9a9589]">{load.customerName}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-0 h-auto md:h-[calc(100vh-65px)]">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between rounded-xl border border-[#e8e6e1] bg-white p-4">
            <div>
              <p className="kpi-label">Status</p>
              <p className="mt-1 text-sm font-semibold text-[#1a1917]">{{ quote: 'Quote', booked: 'Booked', dispatched: 'Dispatched', in_transit: 'In Transit', delivered: 'Delivered', invoiced: 'Invoiced', paid: 'Paid' }[load.status] ?? load.status}</p>
            </div>
            <div className="flex items-center gap-2">
              <select value={load.status} onChange={async e => { const r = await fetch('/api/loads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loadId: load.id, status: e.target.value }) }); if (r.ok) { const d = await r.json(); setLoad(d.load); fetchDocuments() } }} className="select">
                <option value="quote">Quote</option><option value="booked">Booked</option><option value="dispatched">Dispatched</option><option value="in_transit">In Transit</option><option value="delivered">Delivered</option><option value="invoiced">Invoiced</option><option value="paid">Paid</option>
              </select>
              {load.invoiceStatus?.toLowerCase().includes('cleared') && <span className="badge-green">Invoice Cleared</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="kpi-label">Route</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-[#9a9589]">Pick-up</span><span className="text-[#1a1917]">{load.pickUpLocation}</span></div>
                <div className="flex justify-between"><span className="text-[#9a9589]">Delivery</span><span className="text-[#1a1917]">{load.deliveryLocation}</span></div>
                <div className="flex justify-between"><span className="text-[#9a9589]">Pick-up date</span><span className="text-[#1a1917]">{load.pickUpDate || '—'}</span></div>
              </div>
            </div>
            <div className="card p-4">
              <p className="kpi-label">Financials</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-[#9a9589]">Rate</span><span className="font-mono text-amber-600">${load.rate?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-[#9a9589]">Carrier cost</span><span className="font-mono text-[#6b6960]">${load.carrierCost?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-[#9a9589]">Gross commission</span><span className="font-mono text-[#6b6960]">${load.profit?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-[#9a9589]">Net commission</span><span className="font-mono text-emerald-600 font-semibold">+${load.netCommission?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-[#9a9589]">Margin</span><span className="font-mono text-[#9a9589]">{load.marginPct}%</span></div>
              </div>
            </div>
          </div>

          {load.carrierName && <div className="card p-4"><p className="kpi-label">Carrier</p><p className="text-sm text-[#1a1917]">{load.carrierName}</p></div>}
          {load.notes && <div className="card p-4"><p className="kpi-label">Notes</p><p className="text-xs text-[#6b6960]">{load.notes}</p></div>}
        </div>

        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-[#e8e6e1] overflow-y-auto p-4 space-y-4 bg-white">
          <div>
            <p className="kpi-label">Documents</p>
            {(() => { const hasRC = documents.some(d => d.docType === 'RC'); const hasBOL = documents.some(d => d.docType === 'BOL'); const hasPOD = documents.some(d => d.docType === 'POD'); const missing: string[] = []; if (!hasRC) missing.push('RC'); if (!hasBOL) missing.push('BOL'); if (!hasPOD) missing.push('POD'); return missing.length > 0 ? <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-700 border border-amber-200">Missing: {missing.join(', ')}</div> : null })()}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {['RC', 'BOL', 'POD', 'CreditApp', 'OTHER'].map(type => (
                <label key={type} className={`badge cursor-pointer hover:opacity-80 ${type === 'POD' ? 'badge-green' : type === 'BOL' ? 'badge-blue' : type === 'RC' ? 'badge-amber' : type === 'CreditApp' ? 'badge-purple' : 'badge-gray'} ${uploading ? 'opacity-40 pointer-events-none' : ''}`}>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, type); e.target.value = '' }} />+{type}
                </label>
              ))}
            </div>
            {documents.length === 0 ? <p className="text-xs text-[#9a9589]">No documents uploaded</p> : (
              <div className="space-y-1">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg bg-[#f8f7f4] px-3 py-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`badge ${doc.docType === 'POD' ? 'badge-green' : doc.docType === 'BOL' ? 'badge-blue' : doc.docType === 'RC' ? 'badge-amber' : doc.docType === 'CreditApp' ? 'badge-purple' : 'badge-gray'}`}>{doc.docType}</span>
                        <span className="text-xs text-[#1a1917] truncate">{doc.fileName}</span>
                      </div>
                      <p className="text-[10px] text-[#9a9589]">{doc.uploadedBy?.split('@')[0]} · {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                    </div>
                    {doc.fileRef?.startsWith('data:') && <a href={doc.fileRef} download={doc.fileName} className="btn-ghost text-[9px]">DL</a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
