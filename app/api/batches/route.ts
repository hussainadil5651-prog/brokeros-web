import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateMockBatches } from '@/lib/batch-engine'
import { getImportedBatchesByDate, getImportedBatch, deleteBatch } from './import/store'
import { getBatchById } from '@/lib/batch-engine'

const batchSent = new Map<string, boolean>()

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const bid = searchParams.get('id')
  const userId = session.user.email

  if (bid) {
    const imported = await getImportedBatch(bid)
    if (imported) return NextResponse.json({ batch: { ...imported, sent: batchSent.get(bid) ?? false } })
    const batch = getBatchById(bid)
    if (batch) return NextResponse.json({ batch: { ...batch, sent: batchSent.get(bid) ?? false } })
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  const { batches: mockBatches } = generateMockBatches(userId)
  const imported = date ? await getImportedBatchesByDate(date, userId) : []

  const mock = date ? mockBatches.filter((b) => b.batchDate === date) : mockBatches
  const importedIds = new Set(imported.map((b) => b.id))
  const nonOverlapping = mock.filter((b) => !importedIds.has(b.id))
  const allBatches = [...imported, ...nonOverlapping]
  allBatches.sort((a, b) => a.batchNumber - b.batchNumber)

  return NextResponse.json({ batches: allBatches.map(b => ({ ...b, sent: batchSent.get(b.id) ?? false })) })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (body.batchId && body.sent !== undefined) {
    batchSent.set(body.batchId, body.sent)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const bid = searchParams.get('id')
  if (bid) {
    await deleteBatch(bid, session.user.email)
    batchSent.delete(bid)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Missing id' }, { status: 400 })
}
