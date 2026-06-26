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
    setLoading(true); setFetchError('')
    try { const r = await fetch('/api/broker?type=customers'); if (r.ok) setCustomers((await r.json()).customers ?? []); else setFetchError('Failed to load customers') }
    catch { setFetchError('Network error — check your connection') } finally { setLoading(false) }
  }

  useEffect(() => { if (authStatus === 'authenticated') fetchData() }, [authStatus])

  async function handleAdd() {
    if (!form.email) return; setSaving(true); setAddError('')
    try {
      const r = await fetch('/api/broker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, action: 'add-customer', sourceType: 'direct' }) })
      if (r.ok) { setForm({ email: '', companyName: '', contactName: '', phone: '', notes: '' }); setAddOpen(false); await fetchData() }
      else { const d = await r.json().catch(() => ({})); setAddError(d.error || 'Failed to add customer') }
    } catch { setAddError('Network error — try again') } finally { setSaving(false) }
  }

  if (authStatus === 'loading' || loading) return <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]"><div className="spinner" /></div>

  const filtered = search ? customers.filter(c =>
    (c.email || '').toLowerCase().includes(search.toLowerCase()) || (c.companyName || '').toLowerCase().includes(search.toLowerCase())
  ) : customers

  function formatDate(d: string): string { if (!d) return '—'; const date = new Date(d); return isNaN(date.getTime()) ? '—' : date.toLocaleDateString() }

  return (
    <main className="page-container">
      <div className="section-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Active Customers</h1>
            <p className="page-subtitle">{customers.length} customers · working with quotes</p>
          </div>
          <button onClick={() => { setAddOpen(true); setAddError('') }} className="btn-primary">+ Add Customer</button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." className="input max-w-md" />
        {fetchError && <p className="text-xs text-red-500">{fetchError}</p>}
        <div className="card">
          {filtered.length === 0 && !fetchError ? (
            <p className="px-4 py-8 text-center text-xs text-[#9a9589]">No customers yet.</p>
          ) : filtered.length === 0 && fetchError ? null : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Email</th><th>Company</th><th>Contact</th><th>Phone</th><th>Source</th><th>Notes</th><th>Added</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.email}>
                      <td className="font-mono text-[#1a1917]">{c.email || '—'}</td>
                      <td className="text-[#1a1917] font-medium">{c.companyName || '—'}</td>
                      <td className="text-[#6b6960]">{c.contactName || '—'}</td>
                      <td className="text-[#9a9589]">{c.phone || '—'}</td>
                      <td>
                        <span className={`badge ${c.sourceType === 'quote_sent' ? 'badge-green' : c.sourceType === 'interested_prospect' ? 'badge-amber' : 'badge-blue'}`}>
                          {c.sourceType?.replace('_', ' ') || 'direct'}
                        </span>
                      </td>
                      <td className="text-[#9a9589] max-w-[200px] truncate">{c.notes || '—'}</td>
                      <td className="text-[#9a9589]">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {addOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl border border-[#e8e6e1] bg-white p-6 shadow-xl">
              <h2 className="text-base font-semibold text-[#1a1917] mb-4">Add Active Customer</h2>
              {addError && <p className="mb-3 text-xs text-red-500">{addError}</p>}
              <div className="space-y-3">
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email *" className="input w-full" />
                <input type="text" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} placeholder="Company name" className="input w-full" />
                <div className="flex gap-2">
                  <input type="text" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} placeholder="Contact name" className="input flex-1" />
                  <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="input flex-1" />
                </div>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Notes..." className="input w-full resize-none" />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setAddOpen(false)} disabled={saving} className="btn-secondary disabled:opacity-50">Cancel</button>
                <button onClick={handleAdd} disabled={saving || !form.email} className="btn-primary disabled:opacity-50">{saving ? 'Saving...' : 'Add'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
