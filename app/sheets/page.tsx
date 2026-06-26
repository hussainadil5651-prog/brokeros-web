'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface SheetTab { tab: string; allRows: string[][]; headers: string[]; sheetId?: string }

function isMonthRow(row: string[]): boolean { return /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(row.join(' ').trim()) }
function isTotalRow(row: string[]): boolean { return row.join(' ').toLowerCase().includes('total') }
function isHeaderRow(row: string[]): boolean { return /pro\s*no/.test(row.join(' ').toLowerCase()) && /customer\s*rates/i.test(row.join(' ').toLowerCase()) }

export default function SheetsPage() {
  const { status: authStatus } = useSession()
  const [sheets, setSheets] = useState<SheetTab[]>([])
  const [activeTab, setActiveTab] = useState<string>('CW')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addSheetId, setAddSheetId] = useState('')
  const [addSheetName, setAddSheetName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  async function fetchData() {
    setLoading(true)
    try {
      const r = await fetch('/api/sheets/data')
      if (r.ok) {
        const data = await r.json()
        const allSheets = (data.sheets ?? []) as SheetTab[]
        const saved = localStorage.getItem('afa-extra-sheets')
        let extraSheets: { id: string; tab?: string; name?: string; label?: string }[] = []
        try { extraSheets = JSON.parse(saved || '[]') } catch {}

        for (const extra of extraSheets) {
          const resolvedId = extractSheetId(extra.id)
          if (extra.tab) {
            if (!allSheets.some(s => s.tab === extra.tab && s.sheetId === resolvedId)) {
              try { const sr = await fetch(`/api/sheets/data?sheetId=${encodeURIComponent(resolvedId)}&tabName=${encodeURIComponent(extra.tab)}`); if (sr.ok) { const sd = await sr.json(); if (sd.sheets?.length > 0) allSheets.push(sd.sheets[0]) } } catch {}
            }
          } else if (extra.name && !allSheets.some(s => s.sheetId === resolvedId)) {
            try {
              const sr = await fetch(`/api/sheets/data?sheetId=${encodeURIComponent(resolvedId)}&tabName=${encodeURIComponent(extra.name)}`)
              if (sr.ok) { const sd = await sr.json(); if (sd.sheets?.length > 0) allSheets.push(sd.sheets[0]) }
              else { const discR = await fetch(`/api/sheets/data?sheetId=${encodeURIComponent(resolvedId)}`); if (discR.ok) { const discData = await discR.json(); const tabs = (discData.sheets ?? []) as SheetTab[]; for (const t of tabs) { if (!allSheets.some(s => s.tab === t.tab && s.sheetId === resolvedId)) allSheets.push(t) } } }
            } catch {}
          }
        }
        setSheets(allSheets)
      }
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { if (authStatus === 'authenticated') fetchData() }, [authStatus])

  function extractSheetId(input: string): string { const trimmed = input.trim(); if (!trimmed.includes('/') && !trimmed.includes('http')) return trimmed; const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/); if (match) return match[1]; return trimmed }

  async function handleAddSheet() {
    if (!addSheetId.trim()) return; setAdding(true); setAddError('')
    try {
      const resolvedId = extractSheetId(addSheetId)
      const discR = await fetch(`/api/sheets/data?sheetId=${encodeURIComponent(resolvedId)}`)
      if (!discR.ok) { const discData = await discR.json().catch(() => ({})); setAddError(discData.error || 'Cannot read sheet. Make sure it is shared with the service account.'); setAdding(false); return }
      const discData = await discR.json(); const discoveredTabs = (discData.sheets ?? []) as SheetTab[]
      if (discoveredTabs.length === 0) { setAddError('No tabs found in this sheet.'); setAdding(false); return }
      const saved = localStorage.getItem('afa-extra-sheets'); let extraSheets: { id: string; tab: string; label: string }[] = []; try { extraSheets = JSON.parse(saved || '[]') } catch {}
      for (const st of discoveredTabs) { const exists = extraSheets.some(s => s.id === resolvedId && s.tab === st.tab); if (!exists) extraSheets.push({ id: resolvedId, tab: st.tab, label: st.tab }) }
      localStorage.setItem('afa-extra-sheets', JSON.stringify(extraSheets)); setShowAdd(false); setAddSheetId(''); setAddSheetName(''); await fetchData(); setActiveTab(discoveredTabs[0].tab)
    } catch { setAddError('Failed to connect. Check the Sheet ID.') } finally { setAdding(false) }
  }

  function handleRemoveSheet(tabName: string) {
    const saved = localStorage.getItem('afa-extra-sheets'); let extraSheets: { id: string; name: string }[] = []; try { extraSheets = JSON.parse(saved || '[]') } catch {}
    extraSheets = extraSheets.filter(s => s.name !== tabName); localStorage.setItem('afa-extra-sheets', JSON.stringify(extraSheets))
    setSheets(prev => prev.filter(s => s.tab !== tabName)); if (activeTab === tabName) setActiveTab(sheets.find(s => s.tab !== tabName)?.tab ?? 'CW')
  }

  if (authStatus === 'loading') return <div className="flex min-h-screen items-center justify-center bg-[#f8f7f4]"><div className="spinner" /></div>

  const currentSheet = sheets.find(s => s.tab === activeTab)
  const totalRows = currentSheet?.allRows.length ?? 0
  const dataRows = currentSheet?.allRows ?? []
  const maxCols = dataRows.reduce((max, row) => Math.max(max, row.length), 0)
  const columnLetters = maxCols > 0 ? Array.from({ length: maxCols }, (_, i) => String.fromCharCode(65 + (i < 26 ? i : 0))) : []
  const filteredRows = searchQuery ? dataRows.filter(r => r.some(c => String(c).toLowerCase().includes(searchQuery.toLowerCase()))) : dataRows

  return (
    <main className="page-container">
      <div className="section-header">
        <h1 className="page-title">Sheets</h1>
        <p className="page-subtitle">Live Google Sheets viewer — add any sheet shared with the app</p>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1 rounded-lg border border-[#e8e6e1] bg-white p-0.5 overflow-x-auto">
            {sheets.map(s => (
              <button key={s.tab} onClick={() => setActiveTab(s.tab)}
                className={`relative flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                  activeTab === s.tab ? 'bg-amber-500 text-white shadow-sm' : 'text-[#6b6960] hover:bg-[#f3f2ee]'
                }`}>
                {s.tab}
                <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-mono ${activeTab === s.tab ? 'bg-white/20 text-white' : 'bg-[#f3f2ee] text-[#9a9589]'}`}>{s.allRows.length} rows</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdd(true)} className="btn-secondary text-amber-600 border-amber-300">+ Add Sheet</button>
            <button onClick={fetchData} disabled={loading} className="btn-secondary disabled:opacity-50">{loading ? 'Loading...' : 'Refresh'}</button>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-3">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search across all rows..." className="input flex-1" />
          <span className="text-[10px] text-[#9a9589] font-mono">A–{columnLetters[columnLetters.length - 1] || 'A'} · {maxCols} cols</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24"><div className="spinner" /></div>
        ) : currentSheet ? (
          <div className="card overflow-hidden">
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
              <table className="w-full text-left text-[11px] font-mono" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="sticky top-0 z-20 bg-[#f3f2ee] text-[10px] font-semibold text-[#6b6960]">
                    <th className="sticky left-0 z-30 bg-[#f3f2ee] px-2 py-1.5 text-[#9a9589] w-8 border-r border-[#e8e6e1] border-b border-[#e8e6e1] text-center" style={{ minWidth: 40 }}>#</th>
                    {columnLetters.map((letter, ci) => (
                      <th key={ci} className="px-2 py-1.5 font-medium whitespace-nowrap border-r border-[#e8e6e1] border-b border-[#e8e6e1] text-center text-[#9a9589] bg-[#f3f2ee]" style={{ minWidth: 120 }}>{letter}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, ri) => {
                    const isMonth = isMonthRow(row); const isTotal = isTotalRow(row); const isHeader = isHeaderRow(row)
                    const rowNumStyle = isMonth ? 'text-amber-600 bg-amber-50' : isTotal ? 'text-emerald-600 bg-emerald-50' : isHeader ? 'text-blue-600 bg-blue-50' : 'text-[#9a9589]'
                    return (
                      <tr key={ri} className={`transition-all ${isMonth ? 'bg-amber-50' : isTotal ? 'bg-emerald-50' : isHeader ? 'bg-blue-50' : ri % 2 === 0 ? 'bg-white' : 'bg-[#f8f7f4]'}`}>
                        <td className={`sticky left-0 z-10 px-2 py-1 text-[10px] w-8 border-r border-[#e8e6e1] border-b border-[#e8e6e1] text-center ${rowNumStyle}`} style={{ minWidth: 40 }}>{ri + 1}</td>
                        {columnLetters.map((_, ci) => {
                          const cell = row[ci] ?? ''; const isEmpty = cell === ''
                          return (
                            <td key={ci} className={`px-2 py-1 whitespace-nowrap truncate max-w-[250px] border-r border-[#e8e6e1] border-b border-[#e8e6e1] ${
                              isEmpty ? 'text-[#d6d4cc]' : isMonth ? 'text-amber-700 font-semibold' : isTotal ? 'text-emerald-700 font-semibold' : isHeader ? 'text-blue-700 font-semibold' : /^\$?[\d,]+\.?\d*$/.test(String(cell)) ? 'text-[#1a1917] font-mono' : 'text-[#6b6960]'
                            }`} style={{ minWidth: 100 }}>{isEmpty ? '' : cell}</td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#e8e6e1] px-4 py-2 text-[10px] text-[#9a9589] flex items-center justify-between">
              <span>{filteredRows.length} of {totalRows} rows{searchQuery ? ` (filtered)` : ''}</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-amber-300" /> Month</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-emerald-300" /> Total</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-blue-300" /> Header</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-24"><p className="text-xs text-[#9a9589]">Click Refresh to load sheet data</p></div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#e8e6e1] bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-base font-semibold text-[#1a1917]">Add Sheet</h2>
            <p className="mb-4 text-xs text-[#6b6960]">Enter the Sheet ID (from the URL) and a label. The sheet must be shared with <span className="font-mono text-amber-600">afa-sheets@afa-dispatch.iam.gserviceaccount.com</span></p>
            <div className="space-y-3">
              <div>
                <label className="kpi-label">Google Sheet ID</label>
                <input type="text" value={addSheetId} onChange={e => setAddSheetId(e.target.value)} placeholder="Paste full URL or just the Sheet ID" className="input w-full font-mono" />
                <p className="mt-1 text-[10px] text-[#9a9589]">Full URL or just: <span className="font-mono">docs.google.com/spreadsheets/d/<strong className="text-[#6b6960]">1ABCxyz...</strong>/edit</span></p>
              </div>
              <div>
                <label className="kpi-label">Label (optional)</label>
                <input type="text" value={addSheetName} onChange={e => setAddSheetName(e.target.value)} placeholder="e.g. My Prospects" className="input w-full" />
              </div>
              {addError && <p className="text-xs text-red-500">{addError}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowAdd(false); setAddError('') }} className="btn-secondary">Cancel</button>
                <button onClick={handleAddSheet} disabled={adding || !addSheetId.trim()} className="btn-primary disabled:opacity-50">{adding ? 'Connecting...' : 'Add Sheet'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
