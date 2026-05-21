import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getActiveLeads, getActiveLead, addToActiveLeads, updateLeadStatus } from '@/lib/response-store'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const leads = await getActiveLeads(session.user.email)
  return NextResponse.json({ leads })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { email, notes, sourceBatchId, action, status, companyName, contactName, phone } = body
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  if (action === 'move_to_active') {
    const lead = await addToActiveLeads(email, notes ?? '', sourceBatchId ?? '', session.user.email, session.user.email, companyName, contactName, phone)
    return NextResponse.json({ lead })
  }

  if (action === 'update_status' && status) {
    const prevLead = getActiveLead(email, session.user.email)
    await updateLeadStatus(email, status, session.user.email)
    const lead = getActiveLead(email, session.user.email)
    
    const wasJustBooked = status === 'booked' && prevLead?.status !== 'booked'
    return NextResponse.json({ 
      lead,
      conversion: wasJustBooked ? {
        shipperEmail: email,
        companyName: lead?.companyName,
        contactName: lead?.contactName,
        phone: lead?.phone,
        sourceBatchId: lead?.sourceBatchId,
      } : null,
    })
  }

  return NextResponse.json({ lead: getActiveLead(email, session.user.email) })
}
