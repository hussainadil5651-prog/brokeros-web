export interface Batch {
  id: string
  batchDate: string
  batchNumber: number
  emails: string[]
  assignedTo: string
  status: 'pending' | 'in_progress' | 'completed'
  totalEmails: number
  createdAt: string
}

export interface BatchSummary {
  id: string
  batchDate: string
  batchNumber: number
  assignedTo: string
  status: Batch['status']
  totalEmails: number
  createdAt: string
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

export function extractEmails(rows: string[][], emailCol: number): string[] {
  const seen = new Set<string>()

  for (const row of rows) {
    const cell = (row[emailCol] || '').trim()
    if (!cell) continue

    if (/^[\d\s\-\(\)\.\+]+$/.test(cell)) continue

    const parts = cell.split(/[\/\\\n;,|]+/)
    for (const part of parts) {
      const cleaned = part.replace(/\s+/g, '').toLowerCase()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) && cleaned.length < 100) {
        seen.add(cleaned)
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
): Batch[] {
  const batches: Batch[] = []
  const totalBatches = Math.ceil(emails.length / batchSize)

  for (let i = 0; i < emails.length; i += batchSize) {
    const batchEmails = emails.slice(i, i + batchSize)
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
