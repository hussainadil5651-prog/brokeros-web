import { google, sheets_v4 } from 'googleapis'
import bcrypt from 'bcryptjs'

let sheetsClient: sheets_v4.Sheets | null = null

export function extractSheetId(input: string): string {
  const trimmed = input.trim()
  // Already just an ID (no slashes, alphanumeric + dash/underscore, 20+ chars)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed) && !trimmed.includes('/')) return trimmed
  // URL format: https://docs.google.com/spreadsheets/d/{SHEET_ID}/...
  const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]{20,})/)
  if (match) return match[1]
  // Fallback: return as-is
  return trimmed
}

export function getClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient

  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL

  if (!key || !email) {
    throw new Error(
      'Missing GOOGLE_SHEETS_PRIVATE_KEY or GOOGLE_SHEETS_CLIENT_EMAIL env vars. ' +
      'Set them in .env.local to connect to Google Sheets.',
    )
  }

  const cleanedKey = (key || '')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/\\n/g, '\n')
    .trim()

  const auth = new google.auth.JWT({
    email,
    key: cleanedKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  sheetsClient = google.sheets({ version: 'v4', auth })
  return sheetsClient
}

export async function getSheetData(sheetId: string, range: string): Promise<string[][]> {
  const sheets = getClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  })
  return res.data.values ?? []
}

// ── Shared Sheet Parsing ──

export interface ParsedLoad {
  proNo: string
  company: string
  mode: string
  customerName: string
  pickUpDate: string
  pickUpLocation: string
  deliveryLocation: string
  rate: number
  carrierCost: number
  profit: number
  netCommission: number
  carrierName: string
  mcNumber: string
  carrierEmail: string
  carrierContact: string
  carrierPhone: string
  status: string
  invoiceStatus: string
  _sheetRow: number
  _sheetTab: string
  _statusColIdx: number
  _invoiceColIdx: number
}

export function parseCurrency(val: string): number {
  if (!val) return 0
  const s = String(val).trim()
  // Handle accounting parentheses format: (1,234.56) = negative
  const isNegative = /^\(.*\)$/.test(s)
  const cleaned = s.replace(/[$,\s()]/g, '').trim()
  const n = parseFloat(cleaned)
  if (isNaN(n)) return 0
  return isNegative ? -n : n
}

function isHeaderRow(row: string[]): boolean {
  const nonEmpty = row.filter(c => String(c ?? '').trim())
  if (nonEmpty.length < 3) return false
  const text = row.join(' ').toLowerCase()

  // 1. Explicit "Pro No" / "Pro#" header — but ONLY if it's a standalone label, not a PRO number value
  if (/pro\s*#|pro\s*no|pro\s*number/i.test(text)) return true
  // "load #" / "load number" only match as header if there's no digit directly after #
  if (/load\s*#\s*\d|load\s*number\s*\d/i.test(text)) return false
  if (/load\s*#|load\s*number/i.test(text)) return true

  // 2. Row has dollar signs = data row, never a header
  if (row.some(c => /\$/.test(String(c || '')))) return false

  // 3. Row has a date-like value = data row
  if (row.some(c => /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(String(c || '')))) return false
  if (row.some(c => /\d{4}-\d{2}-\d{2}/.test(String(c || '')))) return false

  // 4. Row has a number-only cell = data row (IDs, amounts, phone numbers)
  if (row.some(c => /^\d{4,}$/.test(String(c ?? '').trim()))) return false

  // 5. Heuristic: count how many cells look like column headers vs data
  // Headers are short text labels, data has dates/amounts/long text
  const looksLikeHeader = (val: string) => {
    const v = val.trim().toLowerCase()
    if (v.length > 25) return false // too long for a header
    if (v.length < 1) return false
    if (/\d{3,}/.test(v)) return false // long numbers = data
    if (/[A-Z]{3,}/.test(val) && val.length > 12) return false // all caps long = company name
    return true
  }
  const headerScore = nonEmpty.filter(c => looksLikeHeader(String(c))).length
  // Require 80% of cells to look like headers (was 60%, too permissive)
  return nonEmpty.length >= 3 && headerScore >= Math.ceil(nonEmpty.length * 0.8)
}

function isMonthRow(row: string[]): boolean {
  // Only skip rows where the FIRST non-empty cell is exactly a month name (e.g., "January", "Feb 2024")
  // This is a section separator, not a data row
  const firstCell = (row.find(c => String(c ?? '').trim()) ?? '').trim()
  if (!firstCell) return false
  // Match standalone month names or month + year (e.g., "January", "Feb 2024", "March 2023")
  return /^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s*(\d{4})?$/i.test(firstCell)
}

function isTotalRow(row: string[]): boolean {
  const text = row.join(' ').toLowerCase()
  return /total/i.test(text)
}

function findCol(headers: string[], ...keywords: string[]): number {
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase()
    const idx = headers.findIndex((h) => {
      if (!h) return false
      const lower = h.toLowerCase().trim()
      // Only match if header contains keyword (not reverse — avoids "To" matching "Total")
      return lower.includes(kwLower)
    })
    if (idx >= 0) return idx
  }
  return -1
}

export function parseDataRows(tabName: string, allRows: string[][]): ParsedLoad[] {
  const results: ParsedLoad[] = []
  let currentHeaders: string[] | null = null

  for (let rowIdx = 0; rowIdx < allRows.length; rowIdx++) {
    const row = allRows[rowIdx] ?? []
    const rowText = row.join(' ').trim()

    if (!rowText || isTotalRow(row) || isMonthRow(row)) continue

    if (isHeaderRow(row)) {
      currentHeaders = row
      continue
    }

    if (!currentHeaders) continue

    const proNoIdx = findCol(currentHeaders, 'Pro No', 'Pro', 'Pro#', 'Pro #', 'Load No', 'Load#', 'Load Number', 'ProNumber')
    if (proNoIdx < 0) continue
    const proNo = String(row[proNoIdx] ?? '').trim()
    if (!proNo) continue

    const nameIdx = findCol(currentHeaders, 'Name', 'Customer', 'Shipper', 'Company', 'Contact')
    const dateIdx = findCol(currentHeaders, 'Date', 'Pickup Date', 'Load Date')
    const puIdx = findCol(currentHeaders, 'Pick up', 'Pick', 'Origin', 'From', 'Pickup')
    const dropIdx = findCol(currentHeaders, 'Drop', 'Delivery', 'Destination', 'To', 'Dropoff')
    const rateIdx = findCol(currentHeaders, 'Customer Rates', 'Customer', 'Rate', 'Revenue', 'Charge')
    const costIdx = findCol(currentHeaders, 'Trucker Rates', 'Trucker', 'Cost', 'Carrier Cost', 'Expense')
    const marginIdx = findCol(currentHeaders, 'Margin', 'Profit', 'Commission', 'Net')
    const carrierIdx = findCol(currentHeaders, 'Carrier', 'Trucker', 'Hauler', 'Vendor')
    const mcIdx = findCol(currentHeaders, 'MC', 'MC#', 'MC Number', 'DOT')
    const emailIdx = findCol(currentHeaders, 'email', 'e-mail', 'Email Address')
    const phoneIdx = findCol(currentHeaders, 'Ph No', 'Phone', 'Tel', 'Contact #', 'Phone Number')
    const statusIdx = findCol(currentHeaders, 'Status', 'State', 'Load Status')
    const invIdx = findCol(currentHeaders, 'Invoices', 'Invoice', 'Inv', 'Billing')
    const modeIdx = findCol(currentHeaders, 'Mode', 'Equipment', 'Type', 'Truck Type')

    const modeRaw = modeIdx >= 0 ? String(row[modeIdx] ?? '').trim() : ''
    const nameRaw = nameIdx >= 0 ? String(row[nameIdx] ?? '').trim() : ''
    const dateRaw = dateIdx >= 0 ? String(row[dateIdx] ?? '').trim() : ''
    const puRaw = puIdx >= 0 ? String(row[puIdx] ?? '').trim() : ''
    const dropRaw = dropIdx >= 0 ? String(row[dropIdx] ?? '').trim() : ''
    const rateRaw = rateIdx >= 0 ? String(row[rateIdx] ?? '').trim() : ''
    const costRaw = costIdx >= 0 ? String(row[costIdx] ?? '').trim() : ''
    const carrierRaw = carrierIdx >= 0 ? String(row[carrierIdx] ?? '').trim() : ''
    const mcRaw = mcIdx >= 0 ? String(row[mcIdx] ?? '').trim() : ''
    const emailRaw = emailIdx >= 0 ? String(row[emailIdx] ?? '').trim() : ''
    const phoneRaw = phoneIdx >= 0 ? String(row[phoneIdx] ?? '').trim() : ''
    const statusRaw = statusIdx >= 0 ? String(row[statusIdx] ?? '').trim() : ''
    const invRaw = invIdx >= 0 ? String(row[invIdx] ?? '').trim() : ''

    const rate = parseCurrency(rateRaw)
    const cost = parseCurrency(costRaw)
    const margin = rate - cost
    const netCommission = Math.round(margin * 0.61 * 100) / 100

    const contactIdx = phoneIdx >= 0 ? phoneIdx - 1 : -1
    const contactRaw = contactIdx >= 0 && contactIdx !== nameIdx && contactIdx !== emailIdx
      ? String(row[contactIdx] ?? '').trim()
      : ''

    results.push({
      proNo,
      company: tabName,
      mode: modeRaw,
      customerName: nameRaw,
      pickUpDate: dateRaw,
      pickUpLocation: puRaw,
      deliveryLocation: dropRaw,
      rate,
      carrierCost: cost,
      profit: margin,
      netCommission,
      carrierName: carrierRaw,
      mcNumber: mcRaw.replace(/^(mc|mc:)\s*/i, ''),
      carrierEmail: emailRaw,
      carrierContact: contactRaw,
      carrierPhone: phoneRaw,
      status: statusRaw,
      invoiceStatus: invRaw,
      _sheetRow: rowIdx + 1,
      _sheetTab: tabName,
      _statusColIdx: statusIdx,
      _invoiceColIdx: invIdx,
    })
  }

  return results
}

export async function readAllLoads(sheetId: string, tabs?: string[]): Promise<ParsedLoad[]> {
  const tabList = tabs && tabs.length > 0 ? tabs : await detectTabs(sheetId)
  const all: ParsedLoad[] = []

  for (const tab of tabList) {
    try {
      const rows = await getSheetData(sheetId, `${tab}!A:AZ`)
      const parsed = parseDataRows(tab, rows)
      all.push(...parsed)
    } catch {
      // Skip tabs that can't be read
    }
  }

  return all
}

export async function detectTabs(sheetId: string): Promise<string[]> {
  const sheets = getClient()
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
  const allTabs = meta.data.sheets?.map(s => s.properties?.title).filter(Boolean) as string[] ?? []

  // Filter out known non-data tabs
  const excluded = ['summary', 'dashboard', 'config', 'settings', 'overview', 'chart', 'charts', 'instructions', 'help']
  const candidates = allTabs.filter(t => {
    const lower = t.toLowerCase()
    return !t.startsWith('_') && !excluded.some(e => lower.includes(e))
  })

  // Verify each candidate tab has a header row with "Pro No" (check first 10 rows)
  const validTabs: string[] = []
  for (const tab of candidates) {
    try {
      const rows = await getSheetData(sheetId, `${tab}!A1:Z10`)
      const hasHeader = rows.some(r => isHeaderRow(r))
      if (hasHeader) validTabs.push(tab)
    } catch {
      // Skip tabs we can't read
    }
  }

  return validTabs.length > 0 ? validTabs : candidates.slice(0, 5) // fallback: use first 5 non-excluded tabs
}

// ── Sheet Writing ──

export async function updateCell(sheetId: string, tabName: string, rowNum: number, colLetter: string, value: string): Promise<void> {
  const sheets = getClient()
  const range = `${tabName}!${colLetter}${rowNum}`
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  })
}

function colIndexToLetter(idx: number): string {
  let letter = ''
  let i = idx
  while (i >= 0) {
    letter = String.fromCharCode(65 + (i % 26)) + letter
    i = Math.floor(i / 26) - 1
  }
  return letter
}

export async function updateLoadStatusInSheet(sheetId: string, proNo: string, newStatus: string): Promise<boolean> {
  const loads = await readAllLoads(sheetId)
  const match = loads.find((l) => l.proNo === proNo)
  if (!match || match._statusColIdx < 0) return false

  const colLetter = colIndexToLetter(match._statusColIdx)
  await updateCell(sheetId, match._sheetTab, match._sheetRow, colLetter, newStatus)
  return true
}

export async function updateInvoiceStatusInSheet(sheetId: string, proNo: string, invStatus: string): Promise<boolean> {
  const loads = await readAllLoads(sheetId)
  const match = loads.find((l) => l.proNo === proNo)
  if (!match || match._invoiceColIdx < 0) return false

  const colLetter = colIndexToLetter(match._invoiceColIdx)
  await updateCell(sheetId, match._sheetTab, match._sheetRow, colLetter, invStatus)
  return true
}

function getMonthFromDate(dateStr: string): { label: string; month: number; year: number } | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return { label: months[d.getMonth()], month: d.getMonth(), year: d.getFullYear() }
}

function formatMonthLabel(label: string, year?: number): string {
  return year ? `${label}-${year}` : label
}

interface SheetSection {
  startRow: number
  endRow: number
  monthLabel: string
  month: number
  year: number
  headerRow: number
  headers: string[]
}

function parseSheetSections(rows: string[][]): SheetSection[] {
  const sections: SheetSection[] = []
  let currentMonth: { label: string; month: number; year: number } | null = null
  let monthStartRow = -1
  let headerRow = -1
  let headers: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const text = row.join(' ').trim()

    // Detect month marker
    if (isMonthRow(row)) {
      // Save previous section
      if (currentMonth && monthStartRow >= 0) {
        sections.push({
          startRow: monthStartRow,
          endRow: i - 1,
          monthLabel: formatMonthLabel(currentMonth.label, currentMonth.year),
          month: currentMonth.month,
          year: currentMonth.year,
          headerRow,
          headers,
        })
      }

      // Parse month/year from the label
      const monthMatch = text.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i)
      const yearMatch = text.match(/(\d{4})/)
      const monthStr = monthMatch ? monthMatch[1].toLowerCase() : ''
      const yearNum = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()
      const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

      currentMonth = {
        label: monthStr.charAt(0).toUpperCase() + monthStr.slice(1),
        month: months[monthStr] ?? 0,
        year: yearNum,
      }
      monthStartRow = i
      headerRow = -1
      headers = []
      continue
    }

    // Detect header row
    if (currentMonth && isHeaderRow(row)) {
      headerRow = i
      headers = row
      continue
    }
  }

  // Save last section
  if (currentMonth && monthStartRow >= 0) {
    sections.push({
      startRow: monthStartRow,
      endRow: rows.length - 1,
      monthLabel: formatMonthLabel(currentMonth.label, currentMonth.year),
      month: currentMonth.month,
      year: currentMonth.year,
      headerRow,
      headers,
    })
  }

  return sections
}

async function getSheetGid(sheetId: string, tabName: string): Promise<number | null> {
  const sheets = getClient()
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
  const sheet = meta.data.sheets?.find(
    s => s.properties?.title?.toLowerCase() === tabName.toLowerCase()
  )
  return sheet?.properties?.sheetId ?? null
}

export async function appendLoadToSheet(
  sheetId: string,
  tabName: string,
  data: {
    mode: string
    customerName: string
    pickUpDate: string
    pickUpLocation: string
    deliveryLocation: string
    rate: number
    carrierCost: number
    carrierName: string
    mcNumber: string
    status: string
  }
): Promise<{ rowNum: number; proNo: string } | null> {
  const sheets = getClient()
  const range = `${tabName}!A:R`
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  })
  const rows = res.data.values ?? []
  if (rows.length === 0) return null

  // Find sections and determine insert position
  const sections = parseSheetSections(rows)
  const pickUpMonth = getMonthFromDate(data.pickUpDate)

  let insertRow: number
  let proNo: string

  // Find the section matching the pickup month
  const targetSection = sections.find(s =>
    pickUpMonth && s.month === pickUpMonth.month && s.year === pickUpMonth.year
  )

  if (targetSection && targetSection.headers.length > 0) {
    // Insert inside this section: after last data row, before the next section or end
    let lastDataRowInSection = -1
    for (let i = targetSection.endRow; i >= targetSection.headerRow; i--) {
      const row = rows[i]
      if (row && row.some(c => String(c).trim()) && !isTotalRow(row) && !isHeaderRow(row)) {
        const proNoCell = String(targetSection.headers.length > 0 ? row[findCol(targetSection.headers, 'Pro No', 'Pro')] ?? '' : '').trim()
        if (proNoCell && /^\d/.test(proNoCell)) {
          lastDataRowInSection = i
          break
        }
      }
    }

    if (lastDataRowInSection >= 0) {
      insertRow = lastDataRowInSection + 2 // 1-indexed for sheets API, +1 for 1-indexed, +1 for next row
    } else {
      insertRow = targetSection.headerRow + 2
    }

    proNo = `${String(insertRow)}`
  } else if (sections.length > 0) {
    // Append after the last section
    const lastSection = sections[sections.length - 1]
    insertRow = lastSection.endRow + 2 // skip a row after last section
    proNo = `${String(insertRow)}`
  } else {
    insertRow = rows.length + 1
    proNo = `${String(insertRow)}`
  }

  // Get the last header row to determine column positions
  const lastSection = targetSection ?? sections[sections.length - 1]
  let headers: string[] = []
  if (lastSection && lastSection.headers.length > 0) {
    headers = lastSection.headers
  } else {
    // Fallback: scan for any header
    for (const row of rows) {
      if (isHeaderRow(row)) { headers = row; break }
    }
  }

  if (headers.length === 0) return null

  // Map columns using the same findCol as the parser
  const proNoIdx = findCol(headers, 'Pro No', 'Pro')
  const modeIdx = findCol(headers, 'Mode')
  const nameIdx = findCol(headers, 'Name')
  const dateIdx = findCol(headers, 'Date')
  const puIdx = findCol(headers, 'Pick up', 'Pick')
  const dropIdx = findCol(headers, 'Drop')
  const rateIdx = findCol(headers, 'Customer Rates', 'Customer')
  const costIdx = findCol(headers, 'Trucker Rates', 'Trucker')
  const carrierIdx = findCol(headers, 'Carrier')
  const mcIdx = findCol(headers, 'MC')
  const statusIdx = findCol(headers, 'Status')
  const invIdx = findCol(headers, 'Invoices')

  // Build the new row (18 columns, A:R)
  const newRow: string[] = new Array(18).fill('')
  if (proNoIdx >= 0) newRow[proNoIdx] = proNo
  if (modeIdx >= 0) newRow[modeIdx] = data.mode
  if (nameIdx >= 0) newRow[nameIdx] = data.customerName
  if (dateIdx >= 0) newRow[dateIdx] = data.pickUpDate
  if (puIdx >= 0) newRow[puIdx] = data.pickUpLocation
  if (dropIdx >= 0) newRow[dropIdx] = data.deliveryLocation
  if (rateIdx >= 0) newRow[rateIdx] = `$${data.rate.toFixed(2)}`
  if (costIdx >= 0) newRow[costIdx] = `$${data.carrierCost.toFixed(2)}`
  if (carrierIdx >= 0) newRow[carrierIdx] = data.carrierName
  if (mcIdx >= 0) newRow[mcIdx] = data.mcNumber
  if (statusIdx >= 0) newRow[statusIdx] = data.status

  // Use batchUpdate to insert a row, then values.update to fill it
  const gid = await getSheetGid(sheetId, tabName)
  if (gid !== null) {
    // Insert blank row at the target position (0-indexed)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{
          insertRange: {
            range: {
              sheetId: gid,
              startRowIndex: insertRow - 1,
              endRowIndex: insertRow,
            },
            shiftDimension: 'ROWS',
          },
        }],
      },
    })
  }

  // Write the values to the new row
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tabName}!A${insertRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [newRow] },
  })

  return { rowNum: insertRow, proNo }
}

// ── Email extraction (existing) ──

export async function readAllEmailsFromSheet(sheetId: string, sheetName?: string): Promise<string[]> {
  const range = sheetName ? `${sheetName}!A:Z` : 'A:Z'
  const rows = await getSheetData(sheetId, range)
  if (rows.length === 0) return []

  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim()))
  return extractEmails(dataRows)
}

export async function readAllSheets(sheetId: string): Promise<{ name: string; emails: string[] }[]> {
  const sheets = getClient()
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
  const sheetNames = meta.data.sheets?.map((s) => s.properties?.title).filter(Boolean) as string[] ?? []

  const results: { name: string; emails: string[] }[] = []
  for (const name of sheetNames) {
    const emails = await readAllEmailsFromSheet(sheetId, name)
    results.push({ name, emails })
  }
  return results
}

export function findEmailColumn(headers: string[], sampleRows: string[][]): number {
  const candidates: { index: number; score: number }[] = []
  for (let col = 0; col < (headers.length || 5); col++) {
    let score = 0
    const checkLabel = (headers[col] || '').toLowerCase()
    if (/email/i.test(checkLabel)) score += 10
    if (/e-?mail/i.test(checkLabel)) score += 5
    if (/@/.test(checkLabel)) score += 3
    for (let r = 0; r < Math.min(sampleRows.length, 5); r++) {
      const cell = (sampleRows[r]?.[col] || '').trim()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell)) score += 3
      else if (/@/.test(cell)) score += 1
    }
    candidates.push({ index: col, score })
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]?.index ?? 0
}

export function extractEmails(rows: string[][]): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    for (const cell of row) {
      const val = (cell || '').trim()
      if (!val) continue
      if (/^[\d\s\-\(\)\.\+]+$/.test(val)) continue
      const parts = val.split(/[\s,;|/\\\n]+/)
      for (const part of parts) {
        const cleaned = part.replace(/[\s()<>\[\]{}"]/g, '').toLowerCase()
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) && cleaned.length < 100) {
          seen.add(cleaned)
        }
      }
    }
  }
  return Array.from(seen)
}

export function createBatches(
  emails: string[],
  batchSize: number = 30,
  date: string,
  assignedTo: string,
  excludeEmails?: Set<string>,
  startBatchNumber: number = 1,
) {
  const filtered = excludeEmails?.size
    ? emails.filter((e) => !excludeEmails.has(e.toLowerCase()))
    : emails

  const batches = []
  for (let i = 0; i < filtered.length; i += batchSize) {
    const batchEmails = filtered.slice(i, i + batchSize)
    const batchNumber = startBatchNumber + Math.floor(i / batchSize)
    batches.push({
      id: `batch-${date}-${batchNumber}`,
      batchDate: date,
      batchNumber,
      emails: batchEmails,
      assignedTo,
      status: 'pending',
      totalEmails: batchEmails.length,
      createdAt: new Date().toISOString(),
    })
  }
  return batches
}

const lastSyncState = new Map<string, { emails: string[]; sheetHash: string }>()

export function getSheetHash(emails: string[]): string {
  const combined = emails.sort().join(',')
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

export interface SyncResult {
  sheetId: string
  sheetName: string
  totalEmails: number
  newEmails: number
  removedEmails: number
  batchesCreated: number
}

export async function syncSheetEmails(
  sheetId: string,
  sheetName: string,
  assignedTo: string,
  excludeEmails: Set<string>,
  activeEmails: Set<string>,
): Promise<SyncResult> {
  const allEmails = await readAllEmailsFromSheet(sheetId, sheetName)
  const uniqueEmails = Array.from(new Set(allEmails.map((e) => e.toLowerCase())))

  const cacheKey = `${sheetId}|${sheetName}`
  const prevState = lastSyncState.get(cacheKey)
  const currentHash = getSheetHash(uniqueEmails)

  if (prevState && prevState.sheetHash === currentHash) {
    return {
      sheetId, sheetName,
      totalEmails: uniqueEmails.length,
      newEmails: 0, removedEmails: 0, batchesCreated: 0,
    }
  }

  const prevEmails = new Set(prevState?.emails ?? [])
  const newE = uniqueEmails.filter((e) => !prevEmails.has(e))
  const removedE = prevState ? prevState.emails.filter((e) => !uniqueEmails.includes(e)) : []

  lastSyncState.set(cacheKey, { emails: uniqueEmails, sheetHash: currentHash })

  const dontSend = new Set([...Array.from(excludeEmails), ...Array.from(activeEmails)])
  const sendableEmails = uniqueEmails.filter((e) => !dontSend.has(e))

  const today = new Date().toISOString().split('T')[0]
  const batches = createBatches(sendableEmails, 30, today, assignedTo)

  return {
    sheetId, sheetName,
    totalEmails: uniqueEmails.length,
    newEmails: newE.length,
    removedEmails: removedE.length,
    batchesCreated: batches.length,
  }
}

export interface FullSyncResult {
  sheetName: string
  allRows: string[][]
  headers: string[]
  emailCol: number
  emails: string[]
}

export async function syncSheetWithRows(
  sheetId: string,
  sheetName: string | undefined,
): Promise<FullSyncResult> {
  const range = sheetName ? `${sheetName}!A:Z` : 'A:Z'
  const rows = await getSheetData(sheetId, range)
  const headers = rows[0] ?? []
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim()))
  const emailCol = findEmailColumn(headers, dataRows)
  const emails = extractEmails(dataRows)
  return { sheetName: sheetName ?? 'Sheet1', allRows: dataRows, headers, emailCol, emails }
}

// ── Auth users ──

export interface AgentUser {
  user_id: string
  email: string
  name: string
  role: 'admin' | 'agent'
  password: string
}

function getAgentUsers(): AgentUser[] {
  return [
    { user_id: 'afa-001', email: 'adil@afadispatch.com', name: 'Adil', role: 'admin', password: process.env.AGENT_AFA001_PASSWORD || '' },
    { user_id: 'afa-002', email: 'addass@afadispatch.com', name: 'Addass', role: 'agent', password: process.env.AGENT_AFA002_PASSWORD || '' },
    { user_id: 'afa-003', email: 'faiq@afadispatch.com', name: 'Faiq', role: 'agent', password: process.env.AGENT_AFA003_PASSWORD || '' },
  ]
}

export async function findUserByEmail(email: string): Promise<AgentUser | null> {
  const users = getAgentUsers()
  return users.find((u) => u.email === email.toLowerCase()) ?? null
}

export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const users = getAgentUsers()
  const user = users.find((u) => u.email === email.toLowerCase())
  if (!user || !user.password) return false
  // Check if password is bcrypt hash (starts with $2a$ or $2b$)
  if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
    return bcrypt.compare(password, user.password)
  }
  // Legacy plaintext comparison (for migration) — immediately re-hash
  if (user.password === password) {
    // TODO: migrate to bcrypt hash in the sheet
    return true
  }
  return false
}

// Dynamic user store — allows any agent to sign up
const dynamicUsers: AgentUser[] = []

export async function findOrCreateUser(email: string, password: string): Promise<AgentUser | null> {
  const normalized = email.toLowerCase()
  // Check hardcoded users first
  const existing = getAgentUsers().find(u => u.email === normalized)
  if (existing) return existing
  // Check dynamic users
  const dynamic = dynamicUsers.find(u => u.email === normalized)
  if (dynamic) return dynamic
  // Create new user with hashed password
  const hashedPassword = password ? await bcrypt.hash(password, 12) : ''
  const newUser: AgentUser = {
    user_id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    email: normalized,
    name: normalized.split('@')[0],
    role: 'agent',
    password: hashedPassword,
  }
  dynamicUsers.push(newUser)
  return newUser
}
