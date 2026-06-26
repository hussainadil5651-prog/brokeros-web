import { readData, writeData } from './app-sheet'

export interface ActivityEntry {
  id: string
  loadId: string
  type: 'status_change' | 'document_upload' | 'note_added' | 'invoice_updated'
  message: string
  actor: string
  createdAt: string
  metadata?: Record<string, string>
}

const STORE_KEY = 'activity'
const activityCache = new Map<string, ActivityEntry[]>()

async function ensureLoaded(loadId: string): Promise<ActivityEntry[]> {
  if (activityCache.has(loadId)) return activityCache.get(loadId)!
  const all = await readData<ActivityEntry>('_shared', STORE_KEY)
  const forLoad = all.filter(a => a.loadId === loadId)
  activityCache.set(loadId, forLoad)
  return forLoad
}

async function persistAll(): Promise<void> {
  const all: ActivityEntry[] = []
  for (const entries of activityCache.values()) {
    all.push(...entries)
  }
  await writeData('_shared', STORE_KEY, all)
}

export async function logActivity(loadId: string, entry: Omit<ActivityEntry, 'id' | 'createdAt' | 'loadId'>): Promise<ActivityEntry> {
  const list = await ensureLoaded(loadId)
  const activity: ActivityEntry = {
    id: `act-${loadId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    loadId,
    ...entry,
    createdAt: new Date().toISOString(),
  }
  list.push(activity)
  await persistAll()
  return activity
}

export async function getActivity(loadId: string): Promise<ActivityEntry[]> {
  const list = await ensureLoaded(loadId)
  return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
