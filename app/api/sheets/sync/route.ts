import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClient, findEmailColumn, extractEmails } from '@/lib/google-sheets'
import { getActiveLeads, getSuppressedEmails } from '@/lib/response-store'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { sheetId } = body

  if (!sheetId) {
    return NextResponse.json({ error: 'sheetId is required' }, { status: 400 })
  }

  try {
    const sheets = getClient()
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
    const sheetList = (meta.data.sheets ?? []).map((s) => ({
      name: s.properties?.title ?? 'Unknown',
      gid: s.properties?.sheetId ?? 0,
    }))

    const suppressedSet = new Set((await getSuppressedEmails(session.user.email)).map((s) => s.toLowerCase()))
    const activeSet = new Set((await getActiveLeads(session.user.email)).map((l) => l.email.toLowerCase()))

    const syncedSheets: {
      name: string
      headers: string[]
      rows: string[][]
      detectedEmailCol: number
      emailCount: number
    }[] = []

    let grandTotalEmails = 0

    for (const sheet of sheetList) {
      const range = `${sheet.name}!A:Z`
      const raw = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
      })
      const allRows = raw.data.values ?? []
      if (allRows.length < 2) continue

      const headers = allRows[0].map((c) => String(c ?? ''))
      const dataRows = allRows.slice(1).filter((r) => r.some((c) => String(c ?? '').trim()))
      if (dataRows.length === 0) continue

      const emailCol = findEmailColumn(headers, dataRows)
      const rawEmails = extractEmails(dataRows)

      // Filter
      const clean = rawEmails.filter((e) => {
        const lower = e.toLowerCase()
        if (suppressedSet.has(lower)) return false
        if (activeSet.has(lower)) return false
        return true
      })

      syncedSheets.push({
        name: sheet.name,
        headers,
        rows: dataRows,
        detectedEmailCol: emailCol,
        emailCount: clean.length,
      })

      grandTotalEmails += clean.length
    }

    return NextResponse.json({
      sheets: syncedSheets,
      totalSheets: syncedSheets.length,
      totalEmails: grandTotalEmails,
    })
  } catch (err: any) {
    const message = err?.message ?? String(err)
    if (message.includes('Missing')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('Sheets sync error:', err)
    return NextResponse.json(
      { error: 'Failed to sync sheet. Check the Sheet ID and service account access.' },
      { status: 500 },
    )
  }
}
