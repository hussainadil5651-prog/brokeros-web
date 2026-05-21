import { generateMockBatches, getBatchById } from './batch-engine'
import { getEmailResponse, getComments, isSuppressed, getActiveLead } from './response-store'
import { importedBatches } from '@/app/api/batches/import/store'

export interface EmailSearchResult {
  email: string
  batchId: string
  batchNumber: number
  batchDate: string
  source: 'mock' | 'imported'
  response: { type: string; notes: string; followUpDate: string | null } | null
  comments: { text: string; author: string; createdAt: string }[]
  isSuppressed: boolean
  isActiveLead: boolean
  activeLeadStatus: string | null
}

export async function searchEmails(query: string, userId: string): Promise<EmailSearchResult[]> {
  const q = query.toLowerCase()
  if (!q || q.length < 1) return []
  const results: EmailSearchResult[] = []
  const seen = new Set<string>()

  const { batches: mockBatches } = generateMockBatches(userId)
  for (const summary of mockBatches) {
    const fullBatch = getBatchById(summary.id)
    if (!fullBatch) continue
    for (const email of fullBatch.emails) {
      if (seen.has(email)) continue
      if (!email.toLowerCase().includes(q)) continue
      seen.add(email)
      const response = await getEmailResponse(fullBatch.id, email, userId)
      const emailComments = getComments(email, fullBatch.id)
      const suppressed = await isSuppressed(email, userId)
      const lead = getActiveLead(email, userId)
      results.push({
        email,
        batchId: fullBatch.id,
        batchNumber: fullBatch.batchNumber,
        batchDate: fullBatch.batchDate,
        source: 'mock',
        response: response ? { type: response.response, notes: response.notes, followUpDate: response.followUpDate } : null,
        comments: emailComments.map(c => ({ text: c.text, author: c.author, createdAt: c.createdAt })),
        isSuppressed: suppressed,
        isActiveLead: !!lead,
        activeLeadStatus: lead?.status ?? null,
      })
    }
  }

  for (const [id, batch] of importedBatches) {
    if (batch.assignedTo !== userId) continue
    for (const email of batch.emails) {
      if (seen.has(email)) continue
      if (!email.toLowerCase().includes(q)) continue
      seen.add(email)
      const response = await getEmailResponse(id, email, userId)
      const emailComments = getComments(email, id)
      const suppressed = await isSuppressed(email, userId)
      const lead = getActiveLead(email, userId)
      results.push({
        email,
        batchId: id,
        batchNumber: batch.batchNumber,
        batchDate: batch.batchDate,
        source: 'imported',
        response: response ? { type: response.response, notes: response.notes, followUpDate: response.followUpDate } : null,
        comments: emailComments.map(c => ({ text: c.text, author: c.author, createdAt: c.createdAt })),
        isSuppressed: suppressed,
        isActiveLead: !!lead,
        activeLeadStatus: lead?.status ?? null,
      })
    }
  }

  return results
}

export interface GlobalSearchResult {
  type: 'load' | 'carrier' | 'invoice' | 'email' | 'lead'
  label: string
  subtitle: string
  href: string
  badge?: string
}

export function searchGlobal(query: string, loads: any[], carriers: any[], invoices: any[], userId: string): GlobalSearchResult[] {
  const q = query.toLowerCase()
  if (!q || q.length < 1) return []
  const results: GlobalSearchResult[] = []

  for (const l of loads) {
    const match = l.loadNumber?.toLowerCase().includes(q) || l.customerName?.toLowerCase().includes(q) || l.pickUpLocation?.toLowerCase().includes(q) || l.deliveryLocation?.toLowerCase().includes(q)
    if (match) {
      results.push({ type: 'load', label: `${l.loadNumber} — ${l.customerName}`, subtitle: `${l.pickUpLocation} → ${l.deliveryLocation}`, href: `/loads/${l.id}`, badge: l.status })
    }
  }

  for (const c of carriers) {
    const match = c.companyName?.toLowerCase().includes(q) || c.mcNumber?.toLowerCase().includes(q)
    if (match) {
      results.push({ type: 'carrier', label: c.companyName, subtitle: `MC# ${c.mcNumber || '—'}`, href: `/carriers/${c.id}`, badge: c.insuranceStatus })
    }
  }

  for (const i of invoices) {
    const match = i.invoiceNumber?.toLowerCase().includes(q) || i.customerName?.toLowerCase().includes(q) || i.loadNumber?.toLowerCase().includes(q)
    if (match) {
      results.push({ type: 'invoice', label: `${i.invoiceNumber} — ${i.customerName}`, subtitle: `$${i.amount?.toLocaleString()}`, href: `/invoices`, badge: i.status })
    }
  }

  return results
}
