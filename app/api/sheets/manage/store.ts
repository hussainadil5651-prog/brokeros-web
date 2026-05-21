export interface SavedSheetLink {
  id: string
  sheetId: string
  name: string
  addedAt: string
}

export const savedLinks = new Map<string, SavedSheetLink>()

export function getAllLinks(): SavedSheetLink[] {
  return Array.from(savedLinks.values()).sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
  )
}

export function removeLink(id: string): boolean {
  return savedLinks.delete(id)
}
