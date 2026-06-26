import { readData, writeData, getDataByType } from '@/lib/app-sheet'

export interface ImportedBatch {
  id: string
  batchDate: string
  batchNumber: number
  emails: string[]
  assignedTo: string
  status: string
  totalEmails: number
  createdAt: string
  sent?: boolean
}

const STORE_KEY = 'batches'
export const importedBatches = new Map<string, ImportedBatch>()
let allLoaded = false

async function ensureAllLoaded(): Promise<void> {
  if (allLoaded) return
  const results = await getDataByType<ImportedBatch>(STORE_KEY)
  for (const { data } of results) {
    for (const b of data) {
      importedBatches.set(b.id, b)
    }
  }
  allLoaded = true
}

async function ensureLoaded(_userId: string): Promise<void> {
  await ensureAllLoaded()
}

async function persistForUser(userId: string): Promise<void> {
  const userBatches = Array.from(importedBatches.values()).filter(b => b.assignedTo === userId)
  await writeData(userId, STORE_KEY, userBatches)
}

export async function getImportedBatch(batchId: string): Promise<ImportedBatch | null> {
  await ensureAllLoaded()
  return importedBatches.get(batchId) ?? null
}

export async function getImportedBatchesByDate(date: string, userId: string): Promise<ImportedBatch[]> {
  await ensureLoaded(userId)
  return Array.from(importedBatches.values()).filter(
    (b) => b.batchDate === date && b.assignedTo === userId,
  )
}

export function getAllImportedDates(): string[] {
  const dates = new Set<string>()
  for (const b of importedBatches.values()) {
    dates.add(b.batchDate)
  }
  return Array.from(dates).sort()
}

export async function deleteBatch(batchId: string, userId: string): Promise<void> {
  await ensureLoaded(userId)
  const b = importedBatches.get(batchId)
  if (b && b.assignedTo === userId) {
    importedBatches.delete(batchId)
    await persistForUser(userId)
  }
}

export async function storeBatch(batch: ImportedBatch, userId: string): Promise<void> {
  await ensureLoaded(userId)
  importedBatches.set(batch.id, batch)
  await persistForUser(userId)
}
