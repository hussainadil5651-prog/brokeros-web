'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Batch { id: string; batchDate: string; batchNumber: number; emails: string[]; assignedTo: string; status: string; totalEmails: number; createdAt: string; sent?: boolean }
interface EmailResponse { id: string; batchId: string; email: string; response: string; notes: string; followUpDate: string | null; loggedAt: string }
interface ResponseStats { total: number; responded: number; interested: number; notInterested: number; followUps: number; wrongContact: number; bounced: number; quoteReceived: number }

type ResponseType = 'interested' | 'not_interested' | 'follow_up' | 'wrong_contact' | 'bounced' | 'quote_received'

const RESPONSE_LABELS: Record<ResponseType, string> = {
  interested: 'Interested', not_interested: 'Not Interested', follow_up: 'Follow Up', wrong_contact: 'Wrong Contact', bounced: 'Bounced', quote_received: 'Quote Received',
}
const RESPONSE_COLORS: Record<ResponseType, string> = {
  interested: 'bg-amber-500/15 text-amber-400', not_interested: 'bg-rose-500/15 text-rose-400',
  follow_up: 'bg-amber-500/20 text-amber-300', wrong_contact: 'bg-zinc-700/50 text-zinc-500',
  bounced: 'bg-rose-500/15 text-rose-400', quote_received: 'bg-emerald-500/15 text-emerald-400',
}

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
    if (!params.batchId) return
    setLoading(true)
    try {
      const [batchR, responsesR, suppressedR] = await Promise.all([
        fetch(`/api/batches?id=${params.batchId}`),
        fetch(`/api/responses?batchId=${params.batchId}`),
        fetch('/api/suppressed'),
      ])
      if (batchR.ok) setBatch((await batchR.json()).batch ?? null)
      if (responsesR.ok) {
        const d = await responsesR.json()
        setResponses(d.responses ?? [])
        const s = d.stats
        if (s) setStats(s)
      }
      if (suppressedR.ok) {
        const d = await suppressedR.json()
        setSuppressed(new Set((d.emails ?? []).map((e: string) => e.toLowerCase())))
      }
    } catch {} finally { setLoading(false) }
  }, [params.batchId])

  useEffect(() => { if (authStatus === 'authenticated') fetchData() }, [authStatus, fetchData])

  function getEmailStatus(email: string): { label: string; color: string } | null {
    const lowered = email.toLowerCase()
    if (suppressed.has(lowered)) return { label: 'DND', color: 'bg-rose-500/15 text-rose-400' }
    const found = responses.find(r => r.email === email)
    if (!found) return null
    return { label: RESPONSE_LABELS[found.response as ResponseType] ?? found.response, color: RESPONSE_COLORS[found.response as ResponseType] ?? 'bg-zinc-600/50 text-zinc-400' }
  }

  async function handleResponse(email: string, response: ResponseType) {
    if (!batch || !session?.user?.email) return
    setSelectedEmail(email)
    setSelResponse(response)
    setSelNotes('')
    setSelFollowUp('')
    setSelDraftedEmail('')
    setProspectForm({ companyName: '', contactName: '', phone: '' })
    setActionOpen(true)
  }

  async function handleSuppress(email: string) {
    await fetch('/api/suppressed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    fetchData()
  }

  async function handleUnsuppress(email: string) {
    await fetch('/api/suppressed', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    fetchData()
  }

  async function handleSave() {
    if (!batch || !selectedEmail || !session?.user?.email) return
    setSaving(true)
    try {
      if (selResponse === 'interested' && !prospectForm.companyName) {
        setSaving(false)
        return
      }

      await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: batch.id,
          email: selectedEmail,
          response: selResponse,
          notes: selNotes,
          followUpDate: selResponse === 'follow_up' ? selFollowUp : null,
        }),
      })

      await fetch('/api/suppressed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: selectedEmail }),
      })

      if (selResponse === 'interested') {
        await fetch('/api/broker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add-prospect',
            email: selectedEmail,
            companyName: prospectForm.companyName,
            contactName: prospectForm.contactName,
            phone: prospectForm.phone,
            notes: selNotes,
            sourceBatchId: batch.id,
          }),
        })
      } else if (selResponse === 'quote_received') {
        await fetch('/api/broker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add-customer',
            email: selectedEmail,
            companyName: prospectForm.companyName,
            contactName: prospectForm.contactName,
            phone: prospectForm.phone,
            notes: selNotes,
            sourceType: 'quote_sent',
            sourceBatchId: batch.id,
          }),
        })
      } else if (selResponse === 'follow_up' && selFollowUp) {
        await fetch('/api/broker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add-reminder',
            email: selectedEmail,
            companyName: prospectForm.companyName,
            contactName: prospectForm.contactName,
            notes: selNotes,
            remindAt: selFollowUp,
            draftedEmail: selDraftedEmail || `Hi ${prospectForm.contactName || 'there'},\n\nFollowing up on our previous conversation about your shipping needs. Would you be interested in getting a quote?\n\nBest regards,\n${session?.user?.name || 'Agent'}`,
          }),
        })
      }

      setActionOpen(false)
      fetchData()
    } catch {} finally { setSaving(false) }
  }

  function copyAll() {
    if (!batch) return
    navigator.clipboard.writeText((batch.emails ?? []).join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (authStatus === 'loading' || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div>
  }

  if (!batch) {
    return <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950"><p className="text-zinc-500">Batch not found</p><Link href="/outreach" className="mt-2 text-sm text-amber-400 kinetic">&larr; Back</Link></div>
  }

  const displayDate = new Date(batch.batchDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const visibleEmails = (batch.emails ?? []).filter(e => !suppressed.has(e.toLowerCase()))
  const filteredEmails = emailSearch ? visibleEmails.filter(e => e.toLowerCase().includes(emailSearch.toLowerCase())) : visibleEmails

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="relative border-b border-white/[0.06] px-6 py-4 before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-gradient-to-r before:from-amber-500 before:to-amber-500/0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/outreach" className="text-sm text-zinc-600 kinetic">&larr;</Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Shipper Outreach #{batch.batchNumber}</h1>
                {batch.sent && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium text-emerald-400">Sent</span>}
              </div>
              <p className="text-xs text-zinc-600">{displayDate}</p>
            </div>
          </div>
          <button onClick={copyAll}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition press ${copied ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-500 text-zinc-950 hover:bg-amber-400'}`}>
            {copied ? 'Copied' : 'Copy All'}
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Stats */}
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-zinc-600">{batch.totalEmails} total</span>
          <span className="text-zinc-700">|</span>
          <span className="text-amber-400">{visibleEmails.length} active</span>
          <span className="text-zinc-700">|</span>
          <span className={suppressed.size > 0 ? 'text-rose-400' : 'text-zinc-600'}>{suppressed.size} DND</span>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-500">{responses.length} responded</span>
          {stats && (<><span className="text-zinc-700">|</span>{stats.interested > 0 && <span className="text-amber-400">{stats.interested} interested</span>}{stats.quoteReceived > 0 && <span className="text-emerald-400">{stats.quoteReceived} quotes</span>}{stats.followUps > 0 && <span className="text-amber-300">{stats.followUps} follow-ups</span>}</>)}
        </div>

        {/* Email list */}
        <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50 p-5">
          <input type="text" value={emailSearch} onChange={e => setEmailSearch(e.target.value)} placeholder="Search emails..."
            className="mb-3 w-full rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />

          <p className="mb-3 text-xs text-zinc-600">{filteredEmails.length} of {visibleEmails.length} email{visibleEmails.length !== 1 ? 's' : ''}</p>

          {filteredEmails.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-700">No emails to display</p>
          ) : (
            <div className="space-y-0.5">
              {filteredEmails.map((email, i) => {
                const status = getEmailStatus(email)
                const response = responses.find(r => r.email === email)
                return (
                  <div key={i} className="group rounded-md px-2 py-1.5 transition hover:bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 font-mono text-xs text-zinc-300" style={{ wordBreak: 'break-all' }}>{email}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleResponse(email, 'interested')} className="rounded border border-zinc-700/50 px-2 py-0.5 text-[9px] text-amber-500 hover:bg-amber-500/10 press">Interested</button>
                        <button onClick={() => handleResponse(email, 'quote_received')} className="rounded border border-zinc-700/50 px-2 py-0.5 text-[9px] text-emerald-500 hover:bg-emerald-500/10 press">Quote</button>
                        <button onClick={() => handleResponse(email, 'not_interested')} className="rounded border border-zinc-700/50 px-2 py-0.5 text-[9px] text-rose-500 hover:bg-rose-500/10 press">Declined</button>
                        <button onClick={() => handleResponse(email, 'follow_up')} className="rounded border border-zinc-700/50 px-2 py-0.5 text-[9px] text-amber-300 hover:bg-amber-500/10 press">Reach Later</button>
                        <button onClick={() => handleResponse(email, 'wrong_contact')} className="rounded border border-zinc-700/50 px-2 py-0.5 text-[9px] text-zinc-500 hover:bg-zinc-800 press">Wrong</button>
                        <button onClick={() => handleSuppress(email)} className="rounded px-1.5 py-0.5 text-[9px] text-rose-500 hover:bg-rose-500/10 press">DND</button>
                      </div>
                      {status ? <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.color}`}>{status.label}</span> : null}
                    </div>
                    {response?.notes && (<div className="ml-2 mt-0.5 text-[11px] text-zinc-600">{response.notes}</div>)}
                  </div>
                )
              })}
            </div>
          )}

          {suppressed.size > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-xs text-rose-400 kinetic">{suppressed.size} DND</summary>
              <div className="mt-2 space-y-1">
                {(batch.emails ?? []).filter(e => suppressed.has(e.toLowerCase())).map((email, i) => (
                  <div key={i} className="flex items-center justify-between rounded px-2 py-1 text-xs font-mono text-zinc-600">
                    <span className="line-through">{email}</span>
                    <button onClick={() => handleUnsuppress(email)} className="text-[10px] text-zinc-700 hover:text-zinc-500 press">undo</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Action modal */}
      {actionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-white/[0.06] bg-zinc-900 p-6 max-h-[90vh] overflow-y-auto overlay">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold tracking-tight text-zinc-100">
                {selResponse === 'interested' ? 'Move to Prospects' :
                 selResponse === 'quote_received' ? 'Move to Active Customers' :
                 selResponse === 'follow_up' ? 'Set Reminder' :
                 selResponse === 'not_interested' ? 'Mark as Not Interested' :
                 selResponse === 'wrong_contact' ? 'Wrong Contact' :
                 'Bounced'}
              </h2>
            </div>
            <p className="mb-4 truncate text-xs text-zinc-600 font-mono">{selectedEmail}</p>

            <div className="space-y-4">
              {(selResponse === 'interested' || selResponse === 'quote_received' || selResponse === 'follow_up') && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                  <h3 className="text-xs font-semibold tracking-wider text-amber-400 uppercase">Contact Info</h3>
                  <input type="text" value={prospectForm.companyName} onChange={e => setProspectForm({ ...prospectForm, companyName: e.target.value })} placeholder={selResponse === 'interested' ? 'Company name *' : 'Company name'}
                    className="w-full rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                  <div className="flex gap-2">
                    <input type="text" value={prospectForm.contactName} onChange={e => setProspectForm({ ...prospectForm, contactName: e.target.value })} placeholder="Contact name"
                      className="flex-1 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                    <input type="text" value={prospectForm.phone} onChange={e => setProspectForm({ ...prospectForm, phone: e.target.value })} placeholder="Phone"
                      className="flex-1 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                  </div>
                </div>
              )}

              {(selResponse === 'follow_up') && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-500">Remind me on</label>
                  <input type="date" value={selFollowUp} onChange={e => setSelFollowUp(e.target.value)}
                    className="w-full rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-500/30" />
                  <label className="text-xs font-medium text-zinc-500">Drafted follow-up email</label>
                  <textarea value={selDraftedEmail} onChange={e => setSelDraftedEmail(e.target.value)} rows={4}
                    placeholder={`Hi ${prospectForm.contactName || 'there'},\n\nFollowing up on our previous conversation...\n\nBest regards,\n${session?.user?.name || 'Agent'}`}
                    className="w-full resize-none rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Notes</label>
                <textarea value={selNotes} onChange={e => setSelNotes(e.target.value)} rows={2} placeholder="Add notes..."
                  className="w-full resize-none rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setActionOpen(false)} className="rounded-md px-4 py-2 text-xs text-zinc-600 hover:text-zinc-400 press">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 press disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
