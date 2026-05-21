export interface ActivityEntry {
  id: string
  loadId: string
  type: 'status_change' | 'document_upload' | 'note_added' | 'invoice_updated'
  message: string
  actor: string
  createdAt: string
  metadata?: Record<string, string>
}

const activities = new Map<string, ActivityEntry[]>()

export function logActivity(loadId: string, entry: Omit<ActivityEntry, 'id' | 'createdAt' | 'loadId'>): ActivityEntry {
  const list = activities.get(loadId) ?? []
  const activity: ActivityEntry = {
    id: `act-${loadId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    loadId,
    ...entry,
    createdAt: new Date().toISOString(),
  }
  list.push(activity)
  activities.set(loadId, list)
  return activity
}

export function getActivity(loadId: string): ActivityEntry[] {
  return (activities.get(loadId) ?? []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
