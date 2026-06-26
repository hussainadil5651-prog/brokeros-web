import { getClient } from './google-sheets'

const DATA_TAB = '_AFA_DATA'
const CONFIG_TAB = '_USER_SHEETS'

let initialized = false
let dataCache = new Map<string, { data: any[]; ts: number }>()
const CACHE_TTL = 10_000

function getAppSheetId(): string | null {
  const id = process.env.APP_DATA_SHEET_ID
  return id?.trim() || null
}

export function isAppSheetConfigured(): boolean {
  return !!getAppSheetId()
}

async function ensureTabs(): Promise<void> {
  if (initialized) return
  const sheetId = getAppSheetId()
  if (!sheetId) return

  const sheets = getClient()
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
  const existingTabs = new Set(meta.data.sheets?.map(s => s.properties?.title) ?? [])

  const needed: { title: string; cols: string[] }[] = [
    { title: DATA_TAB, cols: ['userId', 'type', 'data', 'updatedAt'] },
    { title: CONFIG_TAB, cols: ['userId', 'name', 'outreachSheetIds', 'meta'] },
  ]

  for (const tab of needed) {
    if (!existingTabs.has(tab.title)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{
            addSheet: { properties: { title: tab.title } },
          }],
        },
      })
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${tab.title}!A1:${String.fromCharCode(64 + tab.cols.length)}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [tab.cols] },
      })
    }
  }

  initialized = true
}

function cacheKey(userId: string, type: string): string {
  return `${userId}|${type}`
}

function isCacheValid(key: string): boolean {
  const entry = dataCache.get(key)
  return !!entry && Date.now() - entry.ts < CACHE_TTL
}

export async function readData<T>(userId: string, type: string): Promise<T[]> {
  const sheetId = getAppSheetId()
  if (!sheetId) return []

  const key = cacheKey(userId, type)
  if (isCacheValid(key)) return dataCache.get(key)!.data as T[]

  await ensureTabs()

  const sheets = getClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${DATA_TAB}!A:D`,
  })

  const rows = res.data.values ?? []
  const headerRow = rows[0] ?? []
  const userIdIdx = headerRow.indexOf('userId')
  const typeIdx = headerRow.indexOf('type')
  const dataIdx = headerRow.indexOf('data')

  if (userIdIdx < 0 || typeIdx < 0 || dataIdx < 0) return []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if ((row[userIdIdx] ?? '').toLowerCase() === userId.toLowerCase() && row[typeIdx] === type) {
      try {
        const parsed = JSON.parse(row[dataIdx] ?? '[]')
        dataCache.set(key, { data: parsed, ts: Date.now() })
        return parsed as T[]
      } catch { return [] }
    }
  }

  return []
}

export async function writeData<T>(userId: string, type: string, data: T[]): Promise<void> {
  const sheetId = getAppSheetId()
  if (!sheetId) return

  await ensureTabs()

  const key = cacheKey(userId, type)
  dataCache.set(key, { data, ts: Date.now() })

  const sheets = getClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${DATA_TAB}!A:D`,
  })

  const rows = res.data.values ?? []
  const headerRow = rows[0] ?? []
  const userIdIdx = headerRow.indexOf('userId')
  const typeIdx = headerRow.indexOf('type')

  if (userIdIdx < 0 || typeIdx < 0) return

  let foundRow = -1
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if ((row[userIdIdx] ?? '').toLowerCase() === userId.toLowerCase() && row[typeIdx] === type) {
      foundRow = i + 1
      break
    }
  }

  const json = JSON.stringify(data)
  const now = new Date().toISOString()
  const newRow = [userId, type, json, now]

  if (foundRow > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${DATA_TAB}!A${foundRow}:D${foundRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [newRow] },
    })
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${DATA_TAB}!A:D`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [newRow] },
    })
  }
}

export async function appendDataItem<T>(userId: string, type: string, item: T): Promise<void> {
  const existing = await readData<T>(userId, type)
  existing.push(item)
  await writeData(userId, type, existing)
}

export async function updateDataItem<T extends { id: string }>(
  userId: string, type: string, itemId: string, updater: (item: T) => T,
): Promise<void> {
  const existing = await readData<T>(userId, type)
  const idx = existing.findIndex((e: any) => e.id === itemId)
  if (idx >= 0) {
    existing[idx] = updater(existing[idx])
    await writeData(userId, type, existing)
  }
}

export function invalidateCacheFor(userId: string, type: string): void {
  const key = cacheKey(userId, type)
  dataCache.delete(key)
}

export function invalidateAllCache(): void {
  dataCache.clear()
}

export async function getDataByType<T>(type: string): Promise<{ userId: string; data: T[] }[]> {
  const sheetId = getAppSheetId()
  if (!sheetId) return []

  await ensureTabs()

  const sheets = getClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${DATA_TAB}!A:D`,
  })

  const rows = res.data.values ?? []
  const headerRow = rows[0] ?? []
  const userIdIdx = headerRow.indexOf('userId')
  const typeIdx = headerRow.indexOf('type')
  const dataIdx = headerRow.indexOf('data')

  if (userIdIdx < 0 || typeIdx < 0 || dataIdx < 0) return []

  const results: { userId: string; data: T[] }[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row[typeIdx] === type) {
      try {
        const parsed = JSON.parse(row[dataIdx] ?? '[]')
        results.push({ userId: row[userIdIdx] ?? '', data: parsed as T[] })
      } catch {}
    }
  }

  return results
}

export async function readUserConfig(userId: string): Promise<{ name: string; outreachSheetIds: string[]; meta?: Record<string, any> } | null> {
  const sheetId = getAppSheetId()
  if (!sheetId) return null

  await ensureTabs()

  const sheets = getClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${CONFIG_TAB}!A:D`,
  })

  const rows = res.data.values ?? []
  const headerRow = rows[0] ?? []
  const userIdIdx = headerRow.indexOf('userId')
  const nameIdx = headerRow.indexOf('name')
  const sheetsIdx = headerRow.indexOf('outreachSheetIds')
  const metaIdx = headerRow.indexOf('meta')

  if (userIdIdx < 0) return null

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if ((row[userIdIdx] ?? '').toLowerCase() === userId.toLowerCase()) {
      let meta: Record<string, any> | undefined
      if (metaIdx >= 0 && row[metaIdx]) {
        try { meta = JSON.parse(row[metaIdx]) } catch {}
      }
      return {
        name: row[nameIdx] ?? '',
        outreachSheetIds: row[sheetsIdx] ? row[sheetsIdx].split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        meta,
      }
    }
  }

  return { name: '', outreachSheetIds: [] }
}

export async function writeUserConfig(
  userId: string,
  name: string,
  outreachSheetIds: string[],
  meta?: Record<string, any>,
): Promise<void> {
  const sheetId = getAppSheetId()
  if (!sheetId) return

  await ensureTabs()

  const sheets = getClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${CONFIG_TAB}!A:D`,
  })

  const rows = res.data.values ?? []
  const headerRow = rows[0] ?? []
  const userIdIdx = headerRow.indexOf('userId')

  if (userIdIdx < 0) return

  let foundRow = -1
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][userIdIdx] ?? '').toLowerCase() === userId.toLowerCase()) {
      foundRow = i + 1
      break
    }
  }

  const newRow = [userId, name, outreachSheetIds.join(','), meta ? JSON.stringify(meta) : '']

  if (foundRow > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${CONFIG_TAB}!A${foundRow}:D${foundRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [newRow] },
    })
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${CONFIG_TAB}!A:D`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [newRow] },
    })
  }
}
