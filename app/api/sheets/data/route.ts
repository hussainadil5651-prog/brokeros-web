import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSheetData, detectTabs } from '@/lib/google-sheets'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const sheetId = searchParams.get('sheetId')
    const tabName = searchParams.get('tabName')

    if (sheetId && tabName) {
      const rows = await getSheetData(sheetId, `${tabName}!A:Z`)
      return NextResponse.json({ sheets: [{ tab: tabName, allRows: rows, headers: rows[0] ?? [], sheetId }] })
    }

    if (sheetId) {
      const tabs = await detectTabs(sheetId)
      const result: { tab: string; allRows: string[][]; headers: string[]; sheetId: string }[] = []
      for (const tab of tabs) {
        const rows = await getSheetData(sheetId, `${tab}!A:Z`)
        result.push({ tab, allRows: rows, headers: rows[0] ?? [], sheetId })
      }
      return NextResponse.json({ sheets: result })
    }

    return NextResponse.json({ sheets: [] })
  } catch (err: any) {
    const message = String(err?.message ?? err)
    if (message.includes('not found') || message.includes('Unable') || message.includes('parse')) {
      return NextResponse.json({ error: `Sheet access error: ${message.slice(0, 120)}` }, { status: 400 })
    }
    if (message.includes('permission') || message.includes('access') || message.includes('403')) {
      return NextResponse.json({ error: `Access denied: ${message.slice(0, 120)}. Share the sheet with the service account email in Settings.` }, { status: 403 })
    }
    return NextResponse.json({ error: `Connection failed: ${message.slice(0, 200)}` }, { status: 500 })
  }
}
