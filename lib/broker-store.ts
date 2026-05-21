import { readData, writeData, appendDataItem, invalidateCacheFor } from './app-sheet'

export interface Prospect {
  email: string
  companyName: string
  contactName: string
  phone: string
  notes: string
  sourceBatchId: string
  movedAt: string
  movedBy: string
  userId: string
}

export interface ActiveCustomer {
  email: string
  companyName: string
  contactName: string
  phone: string
  notes: string
  sourceType: 'quote_sent' | 'interested_prospect' | 'direct'
  sourceBatchId: string
  createdAt: string
  userId: string
}

export interface CarrierRecord {
  carrierName: string
  mcNumber: string
  lane: string
  customerName: string
  price: number
  loadNumber: string
  date: string
  userId: string
}

export interface Reminder {
  id: string
  email: string
  companyName: string
  contactName: string
  notes: string
  remindAt: string
  draftedEmail: string
  completed: boolean
  createdAt: string
  userId: string
}

const STORE_KEY_PROSPECTS = 'prospects'
const STORE_KEY_CUSTOMERS = 'customers'
const STORE_KEY_CARRIERS = 'carriers'
const STORE_KEY_REMINDERS = 'reminders'

const prospects = new Map<string, Prospect>()
const activeCustomers = new Map<string, ActiveCustomer>()
const carrierDb: CarrierRecord[] = []
const reminders = new Map<string, Reminder>()

let sheetLoaded = new Set<string>()

async function ensureLoaded(userId: string, type: string): Promise<void> {
  const key = `${userId}|${type}`
  if (sheetLoaded.has(key)) return
  sheetLoaded.add(key)

  const data = await readData<any>(userId, type)
  if (data.length === 0) return

  switch (type) {
    case STORE_KEY_PROSPECTS:
      for (const p of data) prospects.set(p.email, p as Prospect)
      break
    case STORE_KEY_CUSTOMERS:
      for (const c of data) activeCustomers.set(c.email, c as ActiveCustomer)
      break
    case STORE_KEY_CARRIERS:
      carrierDb.push(...(data as CarrierRecord[]))
      break
    case STORE_KEY_REMINDERS:
      for (const r of data) reminders.set(r.id, r as Reminder)
      break
  }
}

async function persistToSheet<T>(userId: string, type: string, getAll: () => T[]): Promise<void> {
  const all = getAll()
  if (all.length > 0) {
    await writeData(userId, type, all)
  }
}

// ── Prospects ──

export async function addProspect(
  email: string,
  companyName: string,
  contactName: string,
  phone: string,
  notes: string,
  sourceBatchId: string,
  movedBy: string,
  userId: string,
): Promise<Prospect> {
  await ensureLoaded(userId, STORE_KEY_PROSPECTS)
  const existing = prospects.get(email)
  if (existing && existing.userId === userId) {
    existing.notes = notes || existing.notes
    await persistToSheet(userId, STORE_KEY_PROSPECTS, () => Array.from(prospects.values()).filter(p => p.userId === userId))
    return existing
  }
  const p: Prospect = { email, companyName, contactName, phone, notes, sourceBatchId, movedAt: new Date().toISOString(), movedBy, userId }
  prospects.set(email, p)
  await persistToSheet(userId, STORE_KEY_PROSPECTS, () => Array.from(prospects.values()).filter(p => p.userId === userId))
  return p
}

export async function getProspects(userId: string): Promise<Prospect[]> {
  await ensureLoaded(userId, STORE_KEY_PROSPECTS)
  return Array.from(prospects.values()).filter(p => p.userId === userId).sort((a, b) => new Date(b.movedAt).getTime() - new Date(a.movedAt).getTime())
}

export function getProspect(email: string, userId: string): Prospect | null {
  const p = prospects.get(email)
  return p && p.userId === userId ? p : null
}

// ── Active Customers ──

export async function addActiveCustomer(
  email: string,
  companyName: string,
  contactName: string,
  phone: string,
  notes: string,
  sourceType: ActiveCustomer['sourceType'],
  sourceBatchId: string,
  userId: string,
): Promise<ActiveCustomer> {
  await ensureLoaded(userId, STORE_KEY_CUSTOMERS)
  const existing = activeCustomers.get(email)
  if (existing && existing.userId === userId) {
    existing.notes = notes || existing.notes
    await persistToSheet(userId, STORE_KEY_CUSTOMERS, () => Array.from(activeCustomers.values()).filter(c => c.userId === userId))
    return existing
  }
  const c: ActiveCustomer = { email, companyName, contactName, phone, notes, sourceType, sourceBatchId, createdAt: new Date().toISOString(), userId }
  activeCustomers.set(email, c)
  await persistToSheet(userId, STORE_KEY_CUSTOMERS, () => Array.from(activeCustomers.values()).filter(c => c.userId === userId))
  return c
}

export async function getActiveCustomers(userId: string): Promise<ActiveCustomer[]> {
  await ensureLoaded(userId, STORE_KEY_CUSTOMERS)
  return Array.from(activeCustomers.values()).filter(c => c.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

// ── Carriers ──

export async function addCarrierRecord(
  carrierName: string,
  mcNumber: string,
  lane: string,
  customerName: string,
  price: number,
  loadNumber: string,
  date: string,
  userId: string,
): Promise<CarrierRecord> {
  await ensureLoaded(userId, STORE_KEY_CARRIERS)
  const rec: CarrierRecord = { carrierName, mcNumber, lane, customerName, price, loadNumber, date, userId }
  carrierDb.push(rec)
  await persistToSheet(userId, STORE_KEY_CARRIERS, () => carrierDb.filter(r => r.userId === userId))
  return rec
}

export async function searchCarriers(query: string, userId: string): Promise<CarrierRecord[]> {
  await ensureLoaded(userId, STORE_KEY_CARRIERS)
  const q = query.toLowerCase()
  return carrierDb.filter(r => r.userId === userId && (
    r.carrierName.toLowerCase().includes(q) ||
    r.mcNumber.toLowerCase().includes(q) ||
    r.lane.toLowerCase().includes(q) ||
    r.customerName.toLowerCase().includes(q)
  )).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export async function getAllCarrierRecords(userId: string): Promise<CarrierRecord[]> {
  await ensureLoaded(userId, STORE_KEY_CARRIERS)
  return carrierDb.filter(r => r.userId === userId)
}

export function bulkLoadCarrierRecords(records: CarrierRecord[]): void {
  for (const r of records) {
    carrierDb.push(r)
  }
}

// ── Reminders ──

export async function addReminder(
  email: string,
  companyName: string,
  contactName: string,
  notes: string,
  remindAt: string,
  draftedEmail: string,
  userId: string,
): Promise<Reminder> {
  await ensureLoaded(userId, STORE_KEY_REMINDERS)
  const id = `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const r: Reminder = { id, email, companyName, contactName, notes, remindAt, draftedEmail, completed: false, createdAt: new Date().toISOString(), userId }
  reminders.set(id, r)
  await persistToSheet(userId, STORE_KEY_REMINDERS, () => Array.from(reminders.values()).filter(rem => rem.userId === userId))
  return r
}

export async function getDueReminders(userId: string): Promise<Reminder[]> {
  await ensureLoaded(userId, STORE_KEY_REMINDERS)
  const today = new Date().toISOString().split('T')[0]
  return Array.from(reminders.values()).filter(r => r.remindAt <= today && !r.completed && r.userId === userId)
}

export async function getUpcomingReminders(userId: string): Promise<Reminder[]> {
  await ensureLoaded(userId, STORE_KEY_REMINDERS)
  const today = new Date().toISOString().split('T')[0]
  return Array.from(reminders.values()).filter(r => r.remindAt > today && !r.completed && r.userId === userId).sort((a, b) => a.remindAt.localeCompare(b.remindAt))
}

export async function getAllReminders(userId: string): Promise<Reminder[]> {
  await ensureLoaded(userId, STORE_KEY_REMINDERS)
  return Array.from(reminders.values()).filter(r => r.userId === userId).sort((a, b) => a.remindAt.localeCompare(b.remindAt))
}

export async function completeReminder(id: string, userId: string): Promise<void> {
  const r = reminders.get(id)
  if (r && r.userId === userId) {
    r.completed = true
    await persistToSheet(userId, STORE_KEY_REMINDERS, () => Array.from(reminders.values()).filter(rem => rem.userId === userId))
  }
}

// ── Email exclusions for batch creation ──

export async function getBatchExcludedEmails(userId: string): Promise<Set<string>> {
  await ensureLoaded(userId, STORE_KEY_PROSPECTS)
  await ensureLoaded(userId, STORE_KEY_CUSTOMERS)
  const excluded = new Set<string>()
  for (const p of prospects.values()) {
    if (p.userId === userId) excluded.add(p.email.toLowerCase())
  }
  for (const c of activeCustomers.values()) {
    if (c.userId === userId) excluded.add(c.email.toLowerCase())
  }
  return excluded
}
