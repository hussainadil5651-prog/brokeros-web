'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface AC { email: string; companyName: string; contactName: string; phone: string; notes: string; sourceType: string; createdAt: string }

export default function CustomersPage() {
  const { status: authStatus } = useSession()
  const [customers, setCustomers] = useState<AC[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ email: '', companyName: '', contactName: '', phone: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')

  async function fetchData() {
    setLoading(true)
    setFetchError('')
    try {
      const r = await fetch('/api/broker?type=customers')
      if (r.ok) setCustomers((await r.json()).customers ?? [])
      else setFetchError('Failed to load customers')
    } catch {
      setFetchError('Network error — check your connection')
    } finally { setLoading(false) }
  }

  useEffect(() => { if (authStatus === 'authenticated') fetchData() }, [authStatus])

  async function handleAdd() {
    if (!form.email) return
    setSaving(true)
    setAddError('')
    try {
      const r = await fetch('/api/broker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, action: 'add-customer', sourceType: 'direct' }),
      })
      if (r.ok) {
        setForm({ email: '', companyName: '', contactName: '', phone: '', notes: '' })
        setAddOpen(false)
        await fetchData()
      } else {
        const d = await r.json().catch(() => ({}))
        setAddError(d.error || 'Failed to add customer')
      }
    } catch {
      setAddError('Network error — try again')
    } finally { setSaving(false) }
  }

  if (authStatus === 'loading' || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div>
  }

  const filtered = search ? customers.filter(c =>
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.companyName || '').toLowerCase().includes(search.toLowerCase())
  ) : customers

  function formatDate(d: string): string {
    if (!d) return '—'
    const date = new Date(d)
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
  }

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="relative border-b border-white/[0.06] px-6 py-4 before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-gradient-to-r before:from-amber-500 before:to-amber-500/0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Active Customers</h1>
            <p className="text-xs text-zinc-600">{customers.length} customers · working with quotes</p>
          </div>
          <button onClick={() => { setAddOpen(true); setAddError('') }} className="rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 press">+ Add Customer</button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..."
          className="w-full max-w-md rounded-md border border-white/[0.06] bg-zinc-900/50 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
        {fetchError && <p className="text-xs text-rose-400">{fetchError}</p>}
        <div className="card-highlight rounded-lg border border-white/[0.06] bg-zinc-900/50">
          {filtered.length === 0 && !fetchError ? (
            <p className="px-4 py-8 text-center text-xs text-zinc-700">No customers yet.</p>
          ) : filtered.length === 0 && fetchError ? null : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.email} className="border-b border-white/[0.04] transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-zinc-300">{c.email || '—'}</td>
                      <td className="px-4 py-3 text-zinc-100 font-medium">{c.companyName || '—'}</td>
                      <td className="px-4 py-3 text-zinc-400">{c.contactName || '—'}</td>
                      <td className="px-4 py-3 text-zinc-500">{c.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          c.sourceType === 'quote_sent' ? 'bg-emerald-500/15 text-emerald-400' :
                          c.sourceType === 'interested_prospect' ? 'bg-amber-500/15 text-amber-400' :
                          'bg-blue-500/15 text-blue-400'
                        }`}>{c.sourceType?.replace('_', ' ') || 'direct'}</span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 max-w-[200px] truncate">{c.notes || '—'}</td>
                      <td className="px-4 py-3 text-zinc-600">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {addOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-lg border border-white/[0.06] bg-zinc-900 p-6 overlay">
              <h2 className="text-base font-semibold text-zinc-100 mb-4">Add Active Customer</h2>
              {addError && <p className="mb-3 text-xs text-rose-400">{addError}</p>}
              <div className="space-y-3">
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email *"
                  className="w-full rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                <input type="text" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} placeholder="Company name"
                  className="w-full rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                <div className="flex gap-2">
                  <input type="text" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} placeholder="Contact name"
                    className="flex-1 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                  <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone"
                    className="flex-1 rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
                </div>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Notes..."
                  className="w-full resize-none rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setAddOpen(false)} disabled={saving} className="rounded-md px-4 py-2 text-xs text-zinc-600 hover:text-zinc-400 press disabled:opacity-50">Cancel</button>
                <button onClick={handleAdd} disabled={saving || !form.email}
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
