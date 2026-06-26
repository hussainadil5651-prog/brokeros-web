import { readUserConfig, writeUserConfig } from './app-sheet'

export interface UserConfig {
  name: string
  outreachSheetIds: string[]
  loadSheetId: string
  loadSheetTabs: string[]
  companyName: string
  setupComplete: boolean
}

const DEFAULT_CONFIG: UserConfig = {
  name: '',
  outreachSheetIds: [],
  loadSheetId: '',
  loadSheetTabs: [],
  companyName: '',
  setupComplete: false,
}

export async function getUserConfig(userId: string): Promise<UserConfig> {
  const raw = await readUserConfig(userId)
  if (!raw) return { ...DEFAULT_CONFIG }

  const meta = (raw as any).meta ?? {}
  return {
    name: raw.name ?? meta.name ?? '',
    outreachSheetIds: raw.outreachSheetIds ?? [],
    loadSheetId: meta.loadSheetId ?? '',
    loadSheetTabs: meta.loadSheetTabs ?? [],
    companyName: meta.companyName ?? '',
    setupComplete: meta.setupComplete ?? (raw.outreachSheetIds?.length > 0),
  }
}

export async function saveUserConfig(userId: string, config: Partial<UserConfig>): Promise<void> {
  const existing = await getUserConfig(userId)
  const merged = { ...existing, ...config }

  await writeUserConfig(userId, merged.name, merged.outreachSheetIds, {
    loadSheetId: merged.loadSheetId,
    loadSheetTabs: merged.loadSheetTabs,
    companyName: merged.companyName,
    setupComplete: merged.setupComplete,
  })
}

export function isSetupComplete(config: UserConfig): boolean {
  return config.setupComplete && config.outreachSheetIds.length > 0
}

/**
 * Helper for API routes: get the shared load sheet ID.
 * Uses LOAD_SHEET_ID env var (shared across all users).
 * Throws if not configured.
 */
export async function requireLoadSheet(userId: string): Promise<{ sheetId: string; tabs: string[] }> {
  const config = await getUserConfig(userId)
  const sheetId = process.env.LOAD_SHEET_ID || config.loadSheetId
  if (!sheetId) {
    throw new Error('No load sheet configured. Ask your admin to set LOAD_SHEET_ID in environment variables.')
  }
  return { sheetId, tabs: config.loadSheetTabs }
}
