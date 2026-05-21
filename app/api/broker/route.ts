import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { addProspect, getProspects, addActiveCustomer, getActiveCustomers, searchCarriers, addCarrierRecord, getAllCarrierRecords, addReminder, getDueReminders, completeReminder, getAllReminders, getUpcomingReminders } from '@/lib/broker-store'
import { suppressEmail } from '@/lib/response-store'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'prospects'
  const q = searchParams.get('q') || ''

  switch (type) {
    case 'prospects':
      return NextResponse.json({ prospects: await getProspects(session.user.email) })
    case 'customers':
      return NextResponse.json({ customers: await getActiveCustomers(session.user.email) })
    case 'carriers':
      return NextResponse.json({ carriers: q ? await searchCarriers(q, session.user.email) : await getAllCarrierRecords(session.user.email) })
    case 'reminders-due':
      return NextResponse.json({ reminders: await getDueReminders(session.user.email) })
    case 'reminders-all':
      return NextResponse.json({ reminders: await getAllReminders(session.user.email) })
    case 'reminders-upcoming':
      return NextResponse.json({ reminders: await getUpcomingReminders(session.user.email) })
    default:
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, email, companyName, contactName, phone, notes, sourceBatchId } = body

  switch (action) {
    case 'add-prospect': {
      const p = await addProspect(email, companyName || '', contactName || '', phone || '', notes || '', sourceBatchId || '', session.user.email, session.user.email)
      await suppressEmail(email, session.user.email)
      return NextResponse.json({ prospect: p })
    }
    case 'add-customer': {
      const c = await addActiveCustomer(email, companyName || '', contactName || '', phone || '', notes || '', body.sourceType || 'interested_prospect', sourceBatchId || '', session.user.email)
      await suppressEmail(email, session.user.email)
      return NextResponse.json({ customer: c })
    }
    case 'add-carrier': {
      const rec = await addCarrierRecord(body.carrierName, body.mcNumber, body.lane, body.customerName, body.price || 0, body.loadNumber || '', body.date || '', session.user.email)
      return NextResponse.json({ carrier: rec })
    }
    case 'add-reminder': {
      const r = await addReminder(email, companyName || '', contactName || '', notes || '', body.remindAt, body.draftedEmail || '', session.user.email)
      return NextResponse.json({ reminder: r })
    }
    case 'complete-reminder': {
      await completeReminder(body.reminderId, session.user.email)
      return NextResponse.json({ ok: true })
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
