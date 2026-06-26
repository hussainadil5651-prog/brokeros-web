'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Batch { id: string; batchDate: string; batchNumber: number; emails: string[]; assignedTo: string; status: string; totalEmails: number; createdAt: string; sent?: boolean }
interface EmailResponse { id: string; batchId: string; email: string; response: string; notes: string; followUpDate: string | null; loggedAt: string }
interface ResponseStats { total: number; responded: number; interested: number; notInterested: number; followUps: number; wrongContact: number; bounced: number; quoteReceived: number }

type ResponseType = 'interested' | 'not_interested' | 'follow_up' | 'wrong_contact' | 'bounced' | 'quote_received'

const RESPONSE_LABELS: Record<ResponseType, string> = { interested: 'Interested', not_interested: 'Not Interested', follow_up: 'Follow Up', wrong_contact: 'Wrong Contact', bounced: 'Bounced', quote_received: 'Quote Received' }
const RESPONSE_COLORS: Record<ResponseType, string> = { interested: 'badge-amber', not_interested: 'badge-red', follow_up: 'badge-amber', wrong_contact: 'badge-gray', bounced: 'badge-red', quote_received: 'badge-green' }

export default function BatchDetailPage() {
  const { data: session, status: authStatus } = useSession()
  const params = useParams()
  const [batch, setBatch] = useState<Batch | null>(null)
  const [responses, setResponses] = useState<EmailResponse[]>([])
  const [stats, setStats] = useState<ResponseStats | null>(null)
  const [suppressed, setSuppressed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [emailSearch, setEmailSearch] = useState('')
  const [selectedEmail, setSelectedEmail] = useState('')
  const [actionOpen, setActionOpen] = useState(false)
  const [selResponse, setSelResponse] = useState<ResponseType>('interested')
  const [selNotes, setSelNotes] = useState('')
  const [selFollowUp, setSelFollowUp] = useState('')
  const [selDraftedEmail, setSelDraftedEmail] = useState('')
  const [prospectForm, setProspectForm] = useState({ companyName: '', contactName: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchData = useCallback(async () => {
    if (!params.batchId) return; setLoading(true)
    try {
      const [batchR, responsesR, suppressedR] = await Promise.all([fetch(`/api/batches?id=${params.batchId}`), fetch(`/api/responses?batchId=${params.batchId}`), fetch('/api/suppressed')])
      if (batchR.ok) setBatch((await batchR.json()).batch ?? null)
      if (responsesR.ok) { const d = await responsesR.json(); setResponses(d.responses ?? []); const s = d.stats; if (s) setStats(s) }
      if (suppressedR.ok) { const d = await suppressedR.json(); setSuppressed(new Set((d.emails ?? []).map((e: string) => e.toLowerCase()))) }
    } catch {} finally { setLoading(false) }
  }, [params.batchId])

  useEffect(() => { if (authStatus === 'authenticated') fetchData() }, [authStatus, fetchData])

  function getEmailStatus(email: string): { label: string; color: string } | null {
    const lowered = email.toLowerCase()
    if (suppressed.has(lowered)) return { label: 'DND', color: 'badge-red' }
    const found = responses.find(r => r.email === email)
    if (!found) return null
    return { label: RESPONSE_LABELS[found.response as ResponseType] ?? found.response, color: RESPONSE_COLORS[found.response as ResponseType] ?? 'badge-gray' }
  }

  async function handleResponse(email: string, response: ResponseType) {
    setSelectedEmail(email); setSelResponse(response); setSelNotes(''); setSelFollowUp(''); setSelDraftedEmail(''); setProspectForm({ companyName: '', contactName: '', phone: '' }); setActionOpen(true)
  }

  async function handleSuppress(email: string) { await fetch('/api/suppressed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); fetchData() }
  async function handleUnsuppress(email: string) { await fetch('/api/suppressed', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); fetchData() }

  async function handleSave() {
    if (!batch || !selectedEmail || !session?.user?.email) return; setSaving(true)
    try {
      if (selResponse === 'interested' && !prospectForm.companyName) { setSaving(false); return }
      await fetch('/api/responses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchId: batch.id, email: selectedEmail, response: selResponse, notes: selNotes, followUpDate: selResponse === 'follow_up' ? selFollowUp : null }) })
      await fetch('/api/suppressed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: selectedEmail }) })
      if (selResponse === 'interested') { await fetch('/api/broker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add-prospect', email: selectedEmail, companyName: prospectForm.companyName, contactName: prospectForm.contactName, phone: prospectForm.phone, notes: selNotes, sourceBatchId: batch.id }) }) }
      else if (selResponse === 'quote_received') { await fetch('/api/broker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add-customer', email: selectedEmail, companyName: prospectForm.companyName, contactName: prospectForm.contactName, phone: prospectForm.phone, notes: selNotes, sourceType: 'quote_sent', sourceBatchId: batch.id }) }) }
      else if (selResponse === 'follow_up' && selFollowUp) { await fetch('/api/broker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add-reminder', email: selectedEmail, companyName: prospectForm.companyName, contactName: prospectForm.contactName, notes: selNotes, remindAt: selFollowUp, draftedEmail: selDraftedEmail || `Hi ${prospectForm.contactName || 'there'},\n\nFollowing up on our previous conversation about your shipping needs. Would you be interested in getting a quote?\n\nBest regards,\n${session?.user?.name || 'Agent'}` }) }) }
      setActionOpen(false); fetchData()
    } catch {} finally { setSaving(false) }
  }

  function copyAll() { if (!batch) return; navigator.clipboard.writeText((batch.emails ?? []).join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  if (authStatus === 'loading' || loading) return <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]"><div className="spinner" /></div>
  if (!batch) return <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f7f4]"><p className="text-[#9a9589]">Batch not found</p><Link href="/outreach" className="mt-2 text-sm text-amber-600">&larr; Back</Link></div>

  const displayDate = new Date(batch.batchDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const visibleEmails = (batch.emails ?? []).filter(e => !suppressed.has(e.toLowerCase()))
  const filteredEmails = emailSearch ? visibleEmails.filter(e => e.toLowerCase().includes(emailSearch.toLowerCase())) : visibleEmails

  return (
    <main className="min-h-screen bg-[#f8f7f4]">
      <div className="border-b border-[#e8e6e1] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/outreach" className="text-sm text-[#9a9589] hover:text-[#1a1917]">&larr;</Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight text-[#1a1917]">Shipper Outreach #{batch.batchNumber}</h1>
                {batch.sent && <span className="badge-green">Sent</span>}
              </div>
              <p className="text-xs text-[#9a9589]">{displayDate}</p>
            </div>
          </div>
          <button onClick={copyAll} className={`btn-primary ${copied ? 'bg-amber-100 text-amber-700' : ''}`}>{copied ? 'Copied' : 'Copy All'}</button>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-[#9a9589]">{batch.totalEmails} total</span>
          <span className="text-[#d6d4cc]">|</span>
          <span className="text-amber-600">{visibleEmails.length} active</span>
          <span className="text-[#d6d4cc]">|</span>
          <span className={suppressed.size > 0 ? 'text-red-500' : 'text-[#9a9589]'}>{suppressed.size} DND</span>
          <span className="text-[#d6d4cc]">|</span>
          <span className="text-[#6b6960]">{responses.length} responded</span>
          {stats && (<><span className="text-[#d6d4cc]">|</span>{stats.interested > 0 && <span className="text-amber-600">{stats.interested} interested</span>}{stats.quoteReceived > 0 && <span className="text-emerald-600">{stats.quoteReceived} quotes</span>}{stats.followUps > 0 && <span className="text-amber-500">{stats.followUps} follow-ups</span>}</>)}
        </div>

        <div className="card p-5">
          <input type="text" value={emailSearch} onChange={e => setEmailSearch(e.target.value)} placeholder="Search emails..." className="input w-full mb-3" />
          <p className="mb-3 text-xs text-[#9a9589]">{filteredEmails.length} of {visibleEmails.length} email{visibleEmails.length !== 1 ? 's' : ''}</p>

          {filteredEmails.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#9a9589]">No emails to display</p>
          ) : (
            <div className="space-y-0.5">
              {filteredEmails.map((email, i) => {
                const status = getEmailStatus(email)
                const response = responses.find(r => r.email === email)
                return (
                  <div key={i} className="group rounded-lg px-2 py-1.5 transition-all hover:bg-[#f3f2ee]">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 font-mono text-xs text-[#1a1917]" style={{ wordBreak: 'break-all' }}>{email}</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button onClick={() => handleResponse(email, 'interested')} className="badge badge-amber cursor-pointer hover:opacity-80">Interested</button>
                        <button onClick={() => handleResponse(email, 'quote_received')} className="badge badge-green cursor-pointer hover:opacity-80">Quote</button>
                        <button onClick={() => handleResponse(email, 'not_interested')} className="badge badge-red cursor-pointer hover:opacity-80">Declined</button>
                        <button onClick={() => handleResponse(email, 'follow_up')} className="badge badge-amber cursor-pointer hover:opacity-80">Reach Later</button>
                        <button onClick={() => handleResponse(email, 'wrong_contact')} className="badge badge-gray cursor-pointer hover:opacity-80">Wrong</button>
                        <button onClick={() => handleSuppress(email)} className="text-[9px] text-red-500 hover:text-red-600 px-1">DND</button>
                      </div>
                      {status ? <span className={`flex-shrink-0 ${status.color}`}>{status.label}</span> : null}
                    </div>
                    {response?.notes && <div className="ml-2 mt-0.5 text-[11px] text-[#9a9589]">{response.notes}</div>}
                  </div>
                )
              })}
            </div>
          )}

          {suppressed.size > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-xs text-red-500">{suppressed.size} DND</summary>
              <div className="mt-2 space-y-1">
                {(batch.emails ?? []).filter(e => suppressed.has(e.toLowerCase())).map((email, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg px-2 py-1 text-xs font-mono text-[#9a9589]">
                    <span className="line-through">{email}</span>
                    <button onClick={() => handleUnsuppress(email)} className="text-[10px] text-[#9a9589] hover:text-[#6b6960]">undo</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {actionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[#e8e6e1] bg-white p-6 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-[#1a1917]">
                {selResponse === 'interested' ? 'Move to Prospects' : selResponse === 'quote_received' ? 'Move to Active Customers' : selResponse === 'follow_up' ? 'Set Reminder' : selResponse === 'not_interested' ? 'Mark as Not Interested' : selResponse === 'wrong_contact' ? 'Wrong Contact' : 'Bounced'}
              </h2>
            </div>
            <p className="mb-4 truncate text-xs text-[#9a9589] font-mono">{selectedEmail}</p>
            <div className="space-y-4">
              {(selResponse === 'interested' || selResponse === 'quote_received' || selResponse === 'follow_up') && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-amber-700 uppercase">Contact Info</h3>
                  <input type="text" value={prospectForm.companyName} onChange={e => setProspectForm({ ...prospectForm, companyName: e.target.value })} placeholder={selResponse === 'interested' ? 'Company name *' : 'Company name'} className="input w-full" />
                  <div className="flex gap-2">
                    <input type="text" value={prospectForm.contactName} onChange={e => setProspectForm({ ...prospectForm, contactName: e.target.value })} placeholder="Contact name" className="input flex-1" />
                    <input type="text" value={prospectForm.phone} onChange={e => setProspectForm({ ...prospectForm, phone: e.target.value })} placeholder="Phone" className="input flex-1" />
                  </div>
                </div>
              )}
              {selResponse === 'follow_up' && (
                <div className="space-y-2">
                  <label className="kpi-label">Remind me on</label>
                  <input type="date" value={selFollowUp} onChange={e => setSelFollowUp(e.target.value)} className="input w-full" />
                  <label className="kpi-label">Drafted follow-up email</label>
                  <textarea value={selDraftedEmail} onChange={e => setSelDraftedEmail(e.target.value)} rows={4} placeholder={`Hi ${prospectForm.contactName || 'there'},\n\nFollowing up on our previous conversation...\n\nBest regards,\n${session?.user?.name || 'Agent'}`} className="input w-full resize-none" />
                </div>
              )}
              <div>
                <label className="kpi-label">Notes</label>
                <textarea value={selNotes} onChange={e => setSelNotes(e.target.value)} rows={2} placeholder="Add notes..." className="input w-full resize-none" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setActionOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
