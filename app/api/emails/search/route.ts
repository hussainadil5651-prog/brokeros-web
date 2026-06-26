import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { searchEmails } from '@/lib/search-store'
import { getLoads, getCarriers as getSharedCarriers, getInvoices } from '@/lib/shared-store'
import { getUserConfig } from '@/lib/config'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''
    const scope = searchParams.get('scope') ?? 'email'

    if (scope === 'global') {
      const config = await getUserConfig(session.user.email)
      let loads: any[] = []
      let carriers: any[] = []
      let invoices: any[] = []
      if (config.loadSheetId) {
        loads = await getLoads(config.loadSheetId)
        carriers = await getSharedCarriers(config.loadSheetId)
        invoices = await getInvoices(config.loadSheetId)
      }
      const { searchGlobal } = await import('@/lib/search-store')
      const results = searchGlobal(q, loads, carriers, invoices, session.user.email)
      return NextResponse.json({ results })
    }

    const results = await searchEmails(q, session.user.email)
    return NextResponse.json({ results, total: results.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
