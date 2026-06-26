import { readData, writeData } from '@/lib/app-sheet'

export interface SavedSheetLink {
  id: string
  sheetId: string
  name: string
  addedAt: string
}

const STORE_KEY = 'savedSheets'
let loaded = false
const savedLinks = new Map<string, SavedSheetLink>()

async function ensureLoaded(): Promise<void> {
  if (loaded) return
  loaded = true
  const all = await readData<SavedSheetLink>('_shared', STORE_KEY)
  for (const link of all) {
    savedLinks.set(link.id, link)
  }
}

async function persist(): Promise<void> {
  const all = Array.from(savedLinks.values())
  await writeData('_shared', STORE_KEY, all)
}

export async function getAllLinks(): Promise<SavedSheetLink[]> {
  await ensureLoaded()
  return Array.from(savedLinks.values()).sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
  )
}

export async function removeLink(id: string): Promise<boolean> {
  await ensureLoaded()
  const result = savedLinks.delete(id)
  if (result) await persist()
  return result
}

export async function addLink(sheetId: string, name: string): Promise<SavedSheetLink> {
  await ensureLoaded()
  const entry: SavedSheetLink = {
    id: sheetId,
    sheetId,
    name: name || sheetId,
    addedAt: new Date().toISOString(),
  }
  savedLinks.set(sheetId, entry)
  await persist()
  return entry
}

export async function hasLink(sheetId: string): Promise<boolean> {
  await ensureLoaded()
  return savedLinks.has(sheetId)
}
