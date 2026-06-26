import { readData, writeData } from './app-sheet'

export type ResponseType = 'interested' | 'not_interested' | 'follow_up' | 'wrong_contact' | 'bounced' | 'quote_received'

export interface EmailComment {
  id: string
  email: string
  batchId: string
  text: string
  createdAt: string
  author: string
}

export interface EmailResponse {
  id: string
  batchId: string
  email: string
  response: ResponseType
  notes: string
  followUpDate: string | null
  loggedAt: string
  userId: string
}

export interface FollowUp {
  id: string
  email: string
  batchId: string
  batchNumber: number
  response: ResponseType
  notes: string
  dueDate: string
  completed: boolean
  createdAt: string
  userId: string
}

export interface ActiveLead {
  email: string
  companyName?: string
  contactName?: string
  phone?: string
  notes: string
  sourceBatchId: string
  movedAt: string
  movedBy: string
  status: 'new' | 'quoted' | 'negotiating' | 'booked' | 'lost'
  userId: string
}

const STORE_KEY_RESPONSES = 'responses'
const STORE_KEY_FOLLOWUPS = 'followups'
const STORE_KEY_SUPPRESSED = 'suppressed'
const STORE_KEY_LEADS = 'activeLeads'

const responses = new Map<string, EmailResponse>()
const followUps = new Map<string, FollowUp>()
const suppressedEmails = new Map<string, Set<string>>()
const activeLeads = new Map<string, ActiveLead>()

let sheetLoaded = new Set<string>()

async function ensureLoaded(userId: string, type: string): Promise<void> {
  const key = `${userId}|${type}`
  if (sheetLoaded.has(key)) return
  sheetLoaded.add(key)

  const data = await readData<any>(userId, type)
  if (data.length === 0) return

  switch (type) {
    case STORE_KEY_RESPONSES:
      for (const r of data) responses.set(r.id, r as EmailResponse)
      break
    case STORE_KEY_FOLLOWUPS:
      for (const f of data) followUps.set(f.id, f as FollowUp)
      break
    case STORE_KEY_SUPPRESSED:
      suppressedEmails.set(userId, new Set((data as string[]).map(e => e.toLowerCase())))
      break
    case STORE_KEY_LEADS:
      for (const l of data) activeLeads.set(l.email, l as ActiveLead)
      break
  }
}

async function persistResponses(userId: string): Promise<void> {
  const userResponses = Array.from(responses.values()).filter(r => r.userId === userId)
  await writeData(userId, STORE_KEY_RESPONSES, userResponses)
}

async function persistFollowUps(userId: string): Promise<void> {
  const userFus = Array.from(followUps.values()).filter(f => f.userId === userId)
  await writeData(userId, STORE_KEY_FOLLOWUPS, userFus)
}

async function persistSuppressed(userId: string): Promise<void> {
  const set = suppressedEmails.get(userId)
  const arr = set ? Array.from(set) : []
  await writeData(userId, STORE_KEY_SUPPRESSED, arr)
}

async function persistLeads(userId: string): Promise<void> {
  const userLeads = Array.from(activeLeads.values()).filter(l => l.userId === userId)
  await writeData(userId, STORE_KEY_LEADS, userLeads)
}

function getSuppressed(userId: string): Set<string> {
  if (!suppressedEmails.has(userId)) suppressedEmails.set(userId, new Set())
  return suppressedEmails.get(userId)!
}

// ── Responses ──

export async function logResponse(
  batchId: string,
  email: string,
  response: ResponseType,
  notes: string,
  followUpDate: string | null,
  userId: string,
): Promise<EmailResponse> {
  await ensureLoaded(userId, STORE_KEY_RESPONSES)
  await ensureLoaded(userId, STORE_KEY_FOLLOWUPS)

  const id = `resp-${batchId}-${email.replace(/[^a-z0-9]/gi, '-')}`
  const existing = responses.get(id)

  const entry: EmailResponse = {
    id, batchId, email, response, notes, followUpDate,
    loggedAt: new Date().toISOString(),
    userId,
  }

  if (existing) {
    Object.assign(existing, entry, { loggedAt: new Date().toISOString() })
  } else {
    responses.set(id, entry)
  }

  await persistResponses(userId)

  if (response === 'follow_up' && followUpDate) {
    const batchNumber = parseInt(batchId.split('-').pop() ?? '1', 10)
    const fId = `fu-${id}`
    followUps.set(fId, {
      id: fId, email, batchId, batchNumber, response, notes,
      dueDate: followUpDate, completed: false, createdAt: entry.loggedAt, userId,
    })
    await persistFollowUps(userId)
  } else if (response !== 'follow_up') {
    const fId = `fu-${id}`
    if (followUps.has(fId)) {
      followUps.delete(fId)
      await persistFollowUps(userId)
    }
  }

  return entry
}

export async function getBatchResponses(batchId: string, userId: string): Promise<EmailResponse[]> {
  await ensureLoaded(userId, STORE_KEY_RESPONSES)
  return Array.from(responses.values()).filter((r) => r.batchId === batchId && r.userId === userId)
}

export async function getEmailResponse(batchId: string, email: string, userId: string): Promise<EmailResponse | null> {
  await ensureLoaded(userId, STORE_KEY_RESPONSES)
  const id = `resp-${batchId}-${email.replace(/[^a-z0-9]/gi, '-')}`
  const r = responses.get(id)
  return r && r.userId === userId ? r : null
}

// ── Suppressed ──

export async function suppressEmail(email: string, userId: string): Promise<void> {
  await ensureLoaded(userId, STORE_KEY_SUPPRESSED)
  getSuppressed(userId).add(email.toLowerCase())
  await persistSuppressed(userId)
}

export async function unsuppressEmail(email: string, userId: string): Promise<void> {
  await ensureLoaded(userId, STORE_KEY_SUPPRESSED)
  getSuppressed(userId).delete(email.toLowerCase())
  await persistSuppressed(userId)
}

export async function isSuppressed(email: string, userId: string): Promise<boolean> {
  await ensureLoaded(userId, STORE_KEY_SUPPRESSED)
  return getSuppressed(userId).has(email.toLowerCase())
}

export async function getSuppressedEmails(userId: string): Promise<string[]> {
  await ensureLoaded(userId, STORE_KEY_SUPPRESSED)
  return Array.from(getSuppressed(userId))
}

// ── Active Leads ──

export async function addToActiveLeads(
  email: string,
  notes: string,
  sourceBatchId: string,
  movedBy: string,
  userId: string,
  companyName?: string,
  contactName?: string,
  phone?: string,
): Promise<ActiveLead> {
  await ensureLoaded(userId, STORE_KEY_LEADS)
  const existing = activeLeads.get(email)
  if (existing && existing.userId === userId) {
    existing.notes = notes || existing.notes
    existing.status = 'new'
    await persistLeads(userId)
    return existing
  }

  const lead: ActiveLead = {
    email, companyName, contactName, phone, notes,
    sourceBatchId, movedAt: new Date().toISOString(), movedBy, status: 'new', userId,
  }
  activeLeads.set(email, lead)
  await persistLeads(userId)
  return lead
}

export async function updateLeadStatus(email: string, status: ActiveLead['status'], userId: string): Promise<void> {
  await ensureLoaded(userId, STORE_KEY_LEADS)
  const lead = activeLeads.get(email)
  if (!lead || lead.userId !== userId) return
  const prevStatus = lead.status
  lead.status = status
  await persistLeads(userId)

  if (status === 'booked' && prevStatus !== 'booked') {
    await suppressEmail(email, userId)
    await logResponse(lead.sourceBatchId, email, 'interested', 'Auto-converted: lead booked', null, userId)
  }
}

export async function getActiveLeads(userId: string): Promise<ActiveLead[]> {
  await ensureLoaded(userId, STORE_KEY_LEADS)
  return Array.from(activeLeads.values())
    .filter((l) => l.userId === userId)
    .sort((a, b) => new Date(b.movedAt).getTime() - new Date(a.movedAt).getTime())
}

export function getActiveLead(email: string, userId: string): ActiveLead | null {
  const lead = activeLeads.get(email)
  return lead && lead.userId === userId ? lead : null
}

const commentsCache = new Map<string, EmailComment[]>()
let commentsLoaded = false

async function ensureCommentsLoaded(): Promise<void> {
  if (commentsLoaded) return
  commentsLoaded = true
  const all = await readData<EmailComment>('_shared', 'comments')
  for (const c of all) {
    const key = `${c.email}|${c.batchId}`
    const list = commentsCache.get(key) ?? []
    list.push(c)
    commentsCache.set(key, list)
  }
}

async function persistComments(): Promise<void> {
  const all: EmailComment[] = []
  for (const list of commentsCache.values()) {
    all.push(...list)
  }
  await writeData('_shared', 'comments', all)
}

export async function addComment(email: string, batchId: string, text: string, author: string): Promise<EmailComment> {
  await ensureCommentsLoaded()
  const key = `${email}|${batchId}`
  const list = commentsCache.get(key) ?? []
  const comment: EmailComment = {
    id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    email, batchId, text, createdAt: new Date().toISOString(), author,
  }
  list.push(comment)
  commentsCache.set(key, list)
  await persistComments()
  return comment
}

export async function getComments(email: string, batchId: string): Promise<EmailComment[]> {
  await ensureCommentsLoaded()
  const key = `${email}|${batchId}`
  return commentsCache.get(key) ?? []
}

// ── Follow-ups ──

export async function getFollowUpsDueToday(userId: string): Promise<FollowUp[]> {
  await ensureLoaded(userId, STORE_KEY_FOLLOWUPS)
  const today = new Date().toISOString().split('T')[0]
  return Array.from(followUps.values()).filter((f) => f.dueDate === today && !f.completed && f.userId === userId)
}

export async function getUpcomingFollowUps(days: number, userId: string): Promise<FollowUp[]> {
  await ensureLoaded(userId, STORE_KEY_FOLLOWUPS)
  const today = new Date()
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + days)
  const start = today.toISOString().split('T')[0]
  const end = endDate.toISOString().split('T')[0]

  return Array.from(followUps.values())
    .filter((f) => f.dueDate >= start && f.dueDate <= end && !f.completed && f.userId === userId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export async function markFollowUpCompleted(followUpId: string, userId: string): Promise<void> {
  await ensureLoaded(userId, STORE_KEY_FOLLOWUPS)
  const fu = followUps.get(followUpId)
  if (fu && fu.userId === userId) {
    fu.completed = true
    await persistFollowUps(userId)
  }
}

export async function getAllFollowUps(userId: string): Promise<FollowUp[]> {
  await ensureLoaded(userId, STORE_KEY_FOLLOWUPS)
  return Array.from(followUps.values())
    .filter((f) => f.userId === userId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

// ── Stats ──

export async function getResponseStats(batchId: string, userId: string) {
  const batchResponses = await getBatchResponses(batchId, userId)
  const stats = {
    total: 0, responded: batchResponses.length, interested: 0,
    notInterested: 0, followUps: 0, wrongContact: 0, bounced: 0, quoteReceived: 0,
  }
  for (const r of batchResponses) {
    if (r.response === 'interested') stats.interested++
    else if (r.response === 'not_interested') stats.notInterested++
    else if (r.response === 'follow_up') stats.followUps++
    else if (r.response === 'wrong_contact') stats.wrongContact++
    else if (r.response === 'bounced') stats.bounced++
    else if (r.response === 'quote_received') stats.quoteReceived++
  }
  return stats
}
