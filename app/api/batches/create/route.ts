import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { readUserConfig, getDataByType } from '@/lib/app-sheet'
import { getClient, extractEmails, createBatches, extractSheetId } from '@/lib/google-sheets'
import { storeBatch, getImportedBatchesByDate } from '../import/store'

async function getAllContactedEmails(): Promise<Set<string>> {
  const contacted = new Set<string>()

  const [prospectResults, customerResults, suppressedResults] = await Promise.all([
    getDataByType<any>('prospects'),
    getDataByType<any>('customers'),
    getDataByType<string>('suppressed'),
  ])

  for (const { data } of prospectResults) {
    for (const p of data) {
      if (p.email) contacted.add(p.email.toLowerCase())
    }
  }

  for (const { data } of customerResults) {
    for (const c of data) {
      if (c.email) contacted.add(c.email.toLowerCase())
    }
  }

  for (const { data } of suppressedResults) {
    for (const email of data) {
      contacted.add(email.toLowerCase())
    }
  }

  return contacted
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    const { date } = body

    if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

  const userId = session.user.email
  const config = await readUserConfig(userId)

  if (!config || config.outreachSheetIds.length === 0) {
    return NextResponse.json({ error: 'No outreach sheets configured. Go to Settings to add your sheet IDs.' }, { status: 400 })
  }

  const sheets = getClient()

  // Collect all emails from ALL columns of all tabs in all user's outreach sheets
  const allEmails: string[] = []
  const sheetDetails: { name: string; tab: string; count: number }[] = []

  for (const rawId of config.outreachSheetIds) {
    const sheetId = extractSheetId(rawId)
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
      const tabs = (meta.data.sheets ?? []).map(s => s.properties?.title).filter(Boolean) as string[]

      for (const tabName of tabs) {
        try {
          const range = `${tabName}!A:Z`
          const raw = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range })
          const rows = raw.data.values ?? []
          if (rows.length < 2) continue

          const dataRows = rows.slice(1).filter(r => r.some(c => String(c ?? '').trim()))
          if (dataRows.length === 0) continue

          // Extract emails from EVERY column — any cell can contain an email
          const emails = extractEmails(dataRows)
          allEmails.push(...emails)
          sheetDetails.push({ name: sheetId.slice(0, 12) + '...', tab: tabName, count: emails.length })
        } catch { /* skip tab */ }
      }
    } catch {
      return NextResponse.json({ error: `Failed to read sheet ${sheetId.slice(0, 12)}... . Make sure it is shared with the service account.` }, { status: 400 })
    }
  }

  // Deduplicate across all sheets
  const uniqueEmails = Array.from(new Set(allEmails.map(e => e.toLowerCase())))

  // Step 1: Exclude already-contacted emails across ALL users (cross-partner dedup)
  // Includes prospects, customers, AND suppressed/DND emails from all partners
  const contactedEmails = await getAllContactedEmails()
  let sendable = uniqueEmails.filter(e => !contactedEmails.has(e.toLowerCase()))

  // Step 2: Exclude already-batched emails for this user+date (avoids re-batching)
  const existingBatches = await getImportedBatchesByDate(date, userId)
  const alreadyBatched = new Set<string>()
  let maxBatchNumber = 0
  for (const b of existingBatches) {
    for (const e of b.emails) alreadyBatched.add(e.toLowerCase())
    if (b.batchNumber > maxBatchNumber) maxBatchNumber = b.batchNumber
  }
  sendable = sendable.filter(e => !alreadyBatched.has(e.toLowerCase()))

  if (sendable.length === 0) {
    const totalEmails = uniqueEmails.length
    return NextResponse.json({
      error: `No new emails available. ${totalEmails} total found, ${contactedEmails.size} already contacted across all partners, ${alreadyBatched.size} already in existing batches.`
    }, { status: 400 })
  }

  // Create batches continuing from the last batch number — never overwrites old batches
  const startNum = maxBatchNumber > 0 ? maxBatchNumber + 1 : 1
  const batches = createBatches(sendable, 30, date, userId, undefined, startNum)

  // Persist batches
  for (const b of batches) {
    await storeBatch({
      id: b.id,
      batchDate: b.batchDate,
      batchNumber: b.batchNumber,
      emails: b.emails,
      assignedTo: b.assignedTo,
      status: b.status,
      totalEmails: b.totalEmails,
      createdAt: b.createdAt,
    }, userId)
  }

  return NextResponse.json({
    totalEmails: sendable.length,
    batchesCreated: batches.length,
    sheetsScanned: sheetDetails,
    existingBatchCount: existingBatches.length,
    batches: batches.map(b => ({
      id: b.id,
      batchDate: b.batchDate,
      batchNumber: b.batchNumber,
      totalEmails: b.totalEmails,
      assignedTo: b.assignedTo,
    })),
  })
  } catch (err: any) {
    console.error('Batch creation error:', err)
    return NextResponse.json({ error: 'Failed to create batches. Check sheet permissions.' }, { status: 500 })
  }
}
