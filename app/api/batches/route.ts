import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getImportedBatchesByDate, getImportedBatch, deleteBatch, importedBatches, storeBatch } from './import/store'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const bid = searchParams.get('id')
    const userId = session.user.email

    if (bid) {
      const imported = await getImportedBatch(bid)
      if (imported) return NextResponse.json({ batch: imported })
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Load all batches from sheet first
    const { getDataByType } = await import('@/lib/app-sheet')
    const results = await getDataByType<import('./import/store').ImportedBatch>('batches')
    for (const { data } of results) {
      for (const b of data) {
        importedBatches.set(b.id, b)
      }
    }

    let batches: import('./import/store').ImportedBatch[]
    if (date) {
      batches = Array.from(importedBatches.values()).filter(b => b.batchDate === date && b.assignedTo === userId)
    } else {
      batches = Array.from(importedBatches.values()).filter(b => b.assignedTo === userId)
    }
    batches.sort((a, b) => a.batchNumber - b.batchNumber)

    return NextResponse.json({ batches })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    if (body.batchId && body.sent !== undefined) {
      const batch = importedBatches.get(body.batchId)
      if (batch) {
        batch.sent = body.sent
        await storeBatch(batch, session.user.email)
        return NextResponse.json({ ok: true, batch })
      }
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const bid = searchParams.get('id')
    if (bid) {
      await deleteBatch(bid, session.user.email)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
