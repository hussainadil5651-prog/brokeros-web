import { readData, writeData } from './app-sheet'

export type DocType = 'POD' | 'BOL' | 'RC' | 'CreditApp' | 'Other'

export interface DocumentRecord {
  id: string
  loadNumber: string
  customerName: string
  docType: DocType
  fileName: string
  monthYear: string
  notes: string
  uploadedAt: string
  uploadedBy: string
  fileRef: string
}

const STORE_KEY = 'documents'

let docCache: DocumentRecord[] | null = null
let docCacheTs = 0
const DOC_CACHE_TTL = 10_000

export async function getDocuments(loadNumber?: string): Promise<DocumentRecord[]> {
  const all = await readData<DocumentRecord>('_shared', STORE_KEY)
  if (loadNumber) return all.filter(d => d.loadNumber === loadNumber).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  return all.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
}

export async function getDocumentsByMonth(monthYear: string): Promise<DocumentRecord[]> {
  const all = await getDocuments()
  return all.filter(d => d.monthYear === monthYear)
}

export async function getDocumentMonths(): Promise<string[]> {
  const all = await getDocuments()
  const months = new Set(all.map(d => d.monthYear).filter(Boolean))
  return Array.from(months).sort().reverse()
}

export async function addDocument(
  loadNumber: string,
  customerName: string,
  docType: DocType,
  fileName: string,
  uploadedBy: string,
  notes: string,
  fileRef: string,
): Promise<DocumentRecord> {
  const now = new Date()
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const doc: DocumentRecord = {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    loadNumber, customerName, docType, fileName, monthYear,
    notes, uploadedAt: now.toISOString(), uploadedBy, fileRef,
  }
  const existing = await readData<DocumentRecord>('_shared', STORE_KEY)
  existing.push(doc)
  await writeData('_shared', STORE_KEY, existing)
  return doc
}

export async function deleteDocument(docId: string): Promise<boolean> {
  const existing = await readData<DocumentRecord>('_shared', STORE_KEY)
  const idx = existing.findIndex(d => d.id === docId)
  if (idx < 0) return false
  existing.splice(idx, 1)
  await writeData('_shared', STORE_KEY, existing)
  return true
}
