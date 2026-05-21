import * as XLSX from 'xlsx'

export interface ImportResult {
  fileName: string
  totalRows: number
  emailColumn: string
  emails: string[]
}

export function parseFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        let workbook: XLSX.WorkBook

        if (file.name.endsWith('.csv')) {
          const text = new TextDecoder().decode(data as ArrayBuffer)
          workbook = XLSX.read(text, { type: 'string' })
        } else {
          workbook = XLSX.read(data, { type: 'array' })
        }

        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

        if (rows.length < 2) {
          reject(new Error('File has no data rows'))
          return
        }

        const headers = rows[0].map((h) => String(h ?? ''))
        const dataRows = rows.slice(1).filter((r) => r.some((c) => String(c ?? '').trim()))

        const emailCol = findEmailColumn(headers, dataRows)
        const emails = extractEmails(dataRows, emailCol)

        resolve({
          fileName: file.name,
          totalRows: dataRows.length,
          emailColumn: headers[emailCol] ?? `Column ${emailCol + 1}`,
          emails,
        })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))

    if (file.name.endsWith('.csv')) {
      reader.readAsArrayBuffer(file)
    } else {
      reader.readAsArrayBuffer(file)
    }
  })
}

function findEmailColumn(headers: string[], sampleRows: string[][]): number {
  const candidates: { index: number; score: number }[] = []

  for (let col = 0; col < Math.max(headers.length, 5); col++) {
    let score = 0
    const checkLabel = (headers[col] || '').toLowerCase()
    if (/email/i.test(checkLabel)) score += 10
    if (/e-?mail/i.test(checkLabel)) score += 5
    if (/@/.test(checkLabel)) score += 3

    for (let r = 0; r < Math.min(sampleRows.length, 5); r++) {
      const cell = String(sampleRows[r]?.[col] ?? '').trim().toLowerCase()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell)) {
        score += 3
      } else if (/@/.test(cell)) {
        score += 1
      }
    }

    candidates.push({ index: col, score })
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]?.index ?? 0
}

function extractEmails(rows: string[][], emailCol: number): string[] {
  const seen = new Set<string>()

  for (const row of rows) {
    const cell = String(row[emailCol] ?? '').trim()
    if (!cell) continue

    if (/^[\d\s\-\(\)\.\+]+$/.test(cell)) continue

    const parts = cell.split(/[\/\\\n;,|，、\s]+/)
    for (const part of parts) {
      const cleaned = part.replace(/\s+/g, '').toLowerCase()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) && cleaned.length < 100) {
        seen.add(cleaned)
      }
    }
  }

  return Array.from(seen)
}

export function createFileBatches(
  emails: string[],
  batchSize: number = 30,
  date: string,
  assignedTo: string,
  excludeEmails?: Set<string>,
) {
  const filtered = excludeEmails?.size
    ? emails.filter((e) => !excludeEmails.has(e.toLowerCase()))
    : emails

  const batches = []
  for (let i = 0; i < filtered.length; i += batchSize) {
    const batchEmails = filtered.slice(i, i + batchSize)
    const batchNumber = Math.floor(i / batchSize) + 1
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
