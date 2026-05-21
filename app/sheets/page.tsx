'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface SheetTab { tab: string; allRows: string[][]; headers: string[]; sheetId?: string }

function isMonthRow(row: string[]): boolean {
  return /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(row.join(' ').trim())
}

function isTotalRow(row: string[]): boolean {
  return row.join(' ').toLowerCase().includes('total')
}

function isHeaderRow(row: string[]): boolean {
  return /pro\s*no/.test(row.join(' ').toLowerCase()) && /customer\s*rates/i.test(row.join(' ').toLowerCase())
}

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
          // New format: { id, tab, label } — load exactly that tab
          if (extra.tab) {
            if (!allSheets.some(s => s.tab === extra.tab && s.sheetId === resolvedId)) {
              try {
                const sr = await fetch(`/api/sheets/data?sheetId=${encodeURIComponent(resolvedId)}&tabName=${encodeURIComponent(extra.tab)}`)
                if (sr.ok) {
                  const sd = await sr.json()
                  if (sd.sheets?.length > 0) allSheets.push(sd.sheets[0])
                }
              } catch {}
            }
          // Legacy format: { id, name } where name was used as both label and tab name
          // If that exact tab doesn't exist, discover all tabs from the sheet instead
          } else if (extra.name && !allSheets.some(s => s.sheetId === resolvedId)) {
            try {
              const sr = await fetch(`/api/sheets/data?sheetId=${encodeURIComponent(resolvedId)}&tabName=${encodeURIComponent(extra.name)}`)
              if (sr.ok) {
                const sd = await sr.json()
                if (sd.sheets?.length > 0) allSheets.push(sd.sheets[0])
              } else {
                // Tab name might not match — discover all tabs
                const discR = await fetch(`/api/sheets/data?sheetId=${encodeURIComponent(resolvedId)}`)
                if (discR.ok) {
                  const discData = await discR.json()
                  const tabs = (discData.sheets ?? []) as SheetTab[]
                  for (const t of tabs) {
                    if (!allSheets.some(s => s.tab === t.tab && s.sheetId === resolvedId)) {
                      allSheets.push(t)
                    }
                  }
                }
              }
            } catch {}
          }
        }

        setSheets(allSheets)
      }
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { if (authStatus === 'authenticated') fetchData() }, [authStatus])

  function extractSheetId(input: string): string {
    const trimmed = input.trim()
    // Already a bare ID (no slashes, no http)
    if (!trimmed.includes('/') && !trimmed.includes('http')) return trimmed
    // Extract from URL: /d/{ID}/
    const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (match) return match[1]
    return trimmed
  }

  async function handleAddSheet() {
    if (!addSheetId.trim()) return
    setAdding(true)
    setAddError('')
    try {
      const resolvedId = extractSheetId(addSheetId)
      // First discover tabs from the actual sheet — validates ID + permissions
      const discR = await fetch(`/api/sheets/data?sheetId=${encodeURIComponent(resolvedId)}`)
      if (!discR.ok) {
        const discData = await discR.json().catch(() => ({}))
        setAddError(discData.error || 'Cannot read sheet. Make sure it is shared with the service account.')
        setAdding(false)
        return
      }
      const discData = await discR.json()
      const discoveredTabs = (discData.sheets ?? []) as SheetTab[]

      if (discoveredTabs.length === 0) {
        setAddError('No tabs found in this sheet.')
        setAdding(false)
        return
      }

      // Save each discovered tab separately
      const saved = localStorage.getItem('afa-extra-sheets')
      let extraSheets: { id: string; tab: string; label: string }[] = []
      try { extraSheets = JSON.parse(saved || '[]') } catch {}

      for (const st of discoveredTabs) {
        const exists = extraSheets.some(s => s.id === resolvedId && s.tab === st.tab)
        if (!exists) {
          extraSheets.push({ id: resolvedId, tab: st.tab, label: st.tab })
        }
      }

      localStorage.setItem('afa-extra-sheets', JSON.stringify(extraSheets))
      setShowAdd(false)
      setAddSheetId('')
      setAddSheetName('')
      await fetchData()
      setActiveTab(discoveredTabs[0].tab)
    } catch {
      setAddError('Failed to connect. Check the Sheet ID.')
    } finally { setAdding(false) }
  }

  function handleRemoveSheet(tabName: string) {
    const saved = localStorage.getItem('afa-extra-sheets')
    let extraSheets: { id: string; name: string }[] = []
    try { extraSheets = JSON.parse(saved || '[]') } catch {}
    extraSheets = extraSheets.filter(s => s.name !== tabName)
    localStorage.setItem('afa-extra-sheets', JSON.stringify(extraSheets))
    setSheets(prev => prev.filter(s => s.tab !== tabName))
    if (activeTab === tabName) setActiveTab(sheets.find(s => s.tab !== tabName)?.tab ?? 'CW')
  }

  if (authStatus === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div>
  }

  const currentSheet = sheets.find(s => s.tab === activeTab)
  const totalRows = currentSheet?.allRows.length ?? 0
  const dataRows = currentSheet?.allRows ?? []
  const maxCols = dataRows.reduce((max, row) => Math.max(max, row.length), 0)
  const columnLetters = maxCols > 0 ? Array.from({ length: maxCols }, (_, i) => String.fromCharCode(65 + (i < 26 ? i : 0))) : []

  const filteredRows = searchQuery
    ? dataRows.filter(r => r.some(c => String(c).toLowerCase().includes(searchQuery.toLowerCase())))
    : dataRows

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="relative border-b border-white/[0.06] px-6 py-4 before:absolute before:left-0 before:top-0 before:h-[2px] before:w-full before:bg-gradient-to-r before:from-amber-500 before:to-amber-500/0">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Sheets</h1>
        <p className="text-xs text-zinc-600">Live Google Sheets viewer — add any sheet shared with the app</p>
      </div>

      <div className="p-4">
        {/* Tab bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-zinc-900/50 p-0.5 overflow-x-auto scrollbar-thin">
            {sheets.map(s => (
              <button key={s.tab} onClick={() => setActiveTab(s.tab)}
                className={`relative flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold transition press whitespace-nowrap ${
                  activeTab === s.tab
                    ? 'bg-amber-500 text-zinc-950'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}>
                {s.tab}
                <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-mono ${
                  activeTab === s.tab ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-800 text-zinc-600'
                }`}>{s.allRows.length} rows</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdd(true)}
              className="rounded-md border border-amber-500/30 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 press">
              + Add Sheet
            </button>
            <button onClick={fetchData} disabled={loading}
              className="rounded-md border border-white/[0.06] px-3 py-1.5 text-xs text-zinc-500 hover:bg-white/[0.03] press disabled:opacity-50">
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Search + column indicator */}
        <div className="mb-3 flex items-center gap-3">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search across all rows..."
            className="flex-1 rounded-md border border-white/[0.06] bg-zinc-900/50 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
          <span className="text-[10px] text-zinc-700 font-mono">A–{columnLetters[columnLetters.length - 1] || 'A'} · {maxCols} cols</span>
        </div>

        {/* Sheet viewer */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          </div>
        ) : currentSheet ? (
          <div className="card-highlight rounded-lg border border-white/[0.08] bg-zinc-900/80 overflow-hidden">
            <div className="overflow-auto scrollbar-thin" style={{ maxHeight: 'calc(100vh - 240px)' }}>
              <table className="w-full text-left text-[11px] font-mono" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="sticky top-0 z-20 bg-zinc-800 text-[10px] font-semibold text-zinc-400">
                    <th className="sticky left-0 z-30 bg-zinc-800 px-2 py-1.5 text-zinc-600 w-8 border-r border-white/[0.08] border-b border-white/[0.08] text-center" style={{ minWidth: 40 }}>#</th>
                    {columnLetters.map((letter, ci) => (
                      <th key={ci} className="px-2 py-1.5 font-medium whitespace-nowrap border-r border-white/[0.06] border-b border-white/[0.08] text-center text-zinc-500 bg-zinc-800"
                        style={{ minWidth: 120 }}>
                        {letter}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, ri) => {
                    const isMonth = isMonthRow(row)
                    const isTotal = isTotalRow(row)
                    const isHeader = isHeaderRow(row)
                    const rowNumStyle = isMonth ? 'text-amber-500 bg-amber-500/[0.03]' : isTotal ? 'text-emerald-500 bg-emerald-500/[0.03]' : isHeader ? 'text-blue-500 bg-blue-500/[0.03]' : 'text-zinc-700'
                    return (
                      <tr key={ri} className={`transition hover:bg-white/[0.03] ${
                        isMonth ? 'bg-amber-500/[0.04]' : isTotal ? 'bg-emerald-500/[0.04]' : isHeader ? 'bg-blue-500/[0.04]' : ri % 2 === 0 ? 'bg-zinc-900/40' : ''
                      }`}>
                        <td className={`sticky left-0 z-10 px-2 py-1 text-[10px] w-8 border-r border-white/[0.04] border-b border-white/[0.02] text-center ${rowNumStyle}`}
                          style={{ minWidth: 40 }}>
                          {ri + 1}
                        </td>
                        {columnLetters.map((_, ci) => {
                          const cell = row[ci] ?? ''
                          const isEmpty = cell === ''
                          return (
                            <td key={ci}
                              className={`px-2 py-1 whitespace-nowrap truncate max-w-[250px] border-r border-white/[0.03] border-b border-white/[0.02] ${
                                isEmpty ? 'text-zinc-800/50' : 
                                isMonth ? 'text-amber-300/90 font-semibold' :
                                isTotal ? 'text-emerald-300/90 font-semibold' :
                                isHeader ? 'text-blue-300/90 font-semibold' :
                                /^\$?[\d,]+\.?\d*$/.test(String(cell)) ? 'text-zinc-300 font-mono' :
                                'text-zinc-400'
                              }`}
                              style={{ minWidth: 100 }}>
                              {isEmpty ? '' : cell}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-white/[0.06] px-4 py-2 text-[10px] text-zinc-700 flex items-center justify-between">
              <span>{filteredRows.length} of {totalRows} rows{searchQuery ? ` (filtered)` : ''}</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-amber-500/30" /> Month</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-emerald-500/30" /> Total</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-blue-500/30" /> Header</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-24">
            <p className="text-xs text-zinc-700">Click Refresh to load sheet data</p>
          </div>
        )}
      </div>

      {/* Add Sheet modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-white/[0.06] bg-zinc-900 p-6 overlay">
            <h2 className="mb-1 text-base font-semibold tracking-tight text-zinc-100">Add Sheet</h2>
            <p className="mb-4 text-xs text-zinc-600">
              Enter the Sheet ID (from the URL) and a label. The sheet must be shared with <span className="font-mono text-amber-400/60">afa-sheets@afa-dispatch.iam.gserviceaccount.com</span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Google Sheet ID</label>
                <input type="text" value={addSheetId} onChange={e => setAddSheetId(e.target.value)}
                  placeholder="Paste full URL or just the Sheet ID"
                  className="w-full rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30 font-mono" />
                <p className="mt-1 text-[10px] text-zinc-700">
                  Full URL or just: <span className="font-mono">docs.google.com/spreadsheets/d/<strong className="text-zinc-500">1ABCxyz...</strong>/edit</span>
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Label (optional)</label>
                <input type="text" value={addSheetName} onChange={e => setAddSheetName(e.target.value)}
                  placeholder="e.g. My Prospects"
                  className="w-full rounded-md border border-white/[0.06] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition focus:border-amber-500/30" />
              </div>

              {addError && <p className="text-xs text-red-400">{addError}</p>}

              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowAdd(false); setAddError('') }}
                  className="rounded-md px-4 py-2 text-xs text-zinc-600 hover:text-zinc-400 press">Cancel</button>
                <button onClick={handleAddSheet} disabled={adding || !addSheetId.trim()}
                  className="rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 press disabled:opacity-50">
                  {adding ? 'Connecting...' : 'Add Sheet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
