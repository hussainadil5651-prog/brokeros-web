'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'

interface Load { id: string; loadNumber: string; customerName: string; carrierName: string; pickUpLocation: string; deliveryLocation: string; pickUpDate: string; deliveryDate: string; rate: number; carrierCost: number; profit: number; marginPct: number; status: string; company: string; notes: string; invoiceStatus: string }
interface LoadDoc { id: string; docType: string; originalName: string; uploadedAt: string; dataUrl: string; fileSize: number }



export default function LoadDetailPage() {
  const { data: session, status: authStatus } = useSession()
  const params = useParams()
  const router = useRouter()
  const [load, setLoad] = useState<Load | null>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  async function fetchLoad() {
    try {
      const r = await fetch(`/api/loads?id=${params.loadId}`)
      if (r.ok) setLoad((await r.json()).load ?? null)
    } catch {} finally { setLoading(false) }
  }

  async function fetchDocuments() {
    try {
      const r = await fetch(`/api/documents?loadNumber=${params.loadId}`)
      if (r.ok) setDocuments((await r.json()).documents ?? [])
    } catch {}
  }

  useEffect(() => { if (authStatus === 'authenticated') { fetchLoad(); fetchDocuments() } }, [params.loadId, authStatus])

  async function handleUpload(file: File, docType: string) {
    if (!load) return; setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = reader.result as string
        await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loadNumber: load.id, customerName: load.customerName, docType, fileName: file.name, notes: '', fileRef: dataUrl }),
        })
        await fetchDocuments()
      }
      reader.readAsDataURL(file)
    } finally { setUploading(false) }
  }

  if (authStatus === 'loading' || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div>
  }

  if (!load) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><p className="text-zinc-500">Load not found</p></div>
  }

  return (
    <main className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="relative border-b border-white/[0.06] px-6 py-4 before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-gradient-to-r before:from-amber-500 before:to-amber-500/0">
        <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm text-zinc-600 kinetic">&larr;</button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-100">{load.loadNumber}</h1>
            <span className={`rounded px-1.5 py-0.5 text-[8px] font-mono font-semibold tracking-wider ${load.company === 'ST' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>{load.company}</span>
          </div>
          <p className="text-xs text-zinc-600">{load.customerName}</p>
        </div>
        </div>
      </div>

      <div className="flex gap-0 h-[calc(100vh-65px)]">
        {/* Left: Detail */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-zinc-900/50 p-4">
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Status</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">{load.status === 'delivered' ? 'Delivered' : load.status}</p>
            </div>
            <div className="flex items-center gap-2">
              <select value={load.status} onChange={async e => {
                const r = await fetch('/api/loads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loadId: load.id, status: e.target.value }) })
                if (r.ok) { const d = await r.json(); setLoad(d.load); fetchDocuments() }
              }} className="rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 outline-none transition focus:border-amber-500/30">
                <option value="booked">Booked</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="invoiced">Invoiced</option>
                <option value="paid">Paid</option>
              </select>
              {load.invoiceStatus?.toLowerCase().includes('cleared') && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">Invoice Cleared</span>}
            </div>
          </div>

          {/* Route & Financial info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-4">
              <p className="mb-2 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Route</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-zinc-600">Pick-up</span><span className="text-zinc-300">{load.pickUpLocation}</span></div>
                <div className="flex justify-between"><span className="text-zinc-600">Delivery</span><span className="text-zinc-300">{load.deliveryLocation}</span></div>
                <div className="flex justify-between"><span className="text-zinc-600">Pick-up date</span><span className="text-zinc-300">{load.pickUpDate || '—'}</span></div>
              </div>
            </div>
            <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-4">
              <p className="mb-2 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Financials</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-zinc-600">Rate</span><span className="font-mono text-amber-400">${load.rate?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-zinc-600">Carrier cost</span><span className="font-mono text-zinc-400">${load.carrierCost?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-zinc-600">Profit</span><span className="font-mono text-emerald-400 font-semibold">+${load.profit?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-zinc-600">Margin</span><span className="font-mono text-zinc-500">{load.marginPct}%</span></div>
              </div>
            </div>
          </div>

          {/* Carrier */}
          {load.carrierName && (
            <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-4">
              <p className="mb-2 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Carrier</p>
              <p className="text-sm text-zinc-300">{load.carrierName}</p>
            </div>
          )}

          {/* Notes */}
          {load.notes && (
            <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-4">
              <p className="mb-2 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Notes</p>
              <p className="text-xs text-zinc-400">{load.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Documents */}
        <div className="w-80 border-l border-white/[0.06] overflow-y-auto scrollbar-thin p-4 space-y-4">
          <div>
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Documents</p>
            {(() => {
              const hasRC = documents.some(d => d.docType === 'RC')
              const hasBOL = documents.some(d => d.docType === 'BOL')
              const hasPOD = documents.some(d => d.docType === 'POD')
              const missing: string[] = []
              if (!hasRC) missing.push('RC')
              if (!hasBOL) missing.push('BOL')
              if (!hasPOD) missing.push('POD')
              return missing.length > 0 ? (
                <div className="mb-3 rounded-md bg-amber-500/5 px-3 py-2 text-[10px] text-amber-400">Missing: {missing.join(', ')}</div>
              ) : null
            })()}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {['RC', 'BOL', 'POD', 'CreditApp', 'OTHER'].map(type => (
                <label key={type} className={`rounded-md border px-2.5 py-1 text-[10px] font-medium cursor-pointer transition press ${uploading ? 'opacity-40 pointer-events-none' : ''} ${
                  type === 'POD' ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' :
                  type === 'BOL' ? 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10' :
                  type === 'RC' ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10' :
                  type === 'CreditApp' ? 'border-violet-500/30 text-violet-400 hover:bg-violet-500/10' : 'border-zinc-600/50 text-zinc-400 hover:bg-zinc-800'
                }`}>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, type); e.target.value = '' }} />
                  +{type}
                </label>
              ))}
            </div>
            {documents.length === 0 ? (
              <p className="text-xs text-zinc-700">No documents uploaded</p>
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
                          doc.docType === 'CreditApp' ? 'bg-violet-500/10 text-violet-400' : 'bg-zinc-600/30 text-zinc-500'
                        }`}>{doc.docType}</span>
                        <span className="text-xs text-zinc-400 truncate">{doc.fileName}</span>
                      </div>
                      <p className="text-[10px] text-zinc-700">{doc.uploadedBy?.split('@')[0]} · {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                    </div>
                    {doc.fileRef?.startsWith('data:') && (
                      <a href={doc.fileRef} download={doc.fileName} className="rounded border border-white/[0.06] px-2 py-0.5 text-[9px] text-zinc-500 hover:text-zinc-300 press">DL</a>
                    )}
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
