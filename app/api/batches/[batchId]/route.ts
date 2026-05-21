import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBatchById } from '@/lib/batch-engine'
import { getImportedBatch } from '../import/store'

export async function GET(
  req: NextRequest,
  { params }: { params: { batchId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const imported = await getImportedBatch(params.batchId)
  if (imported) {
    if (imported.assignedTo !== session.user.email) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ batch: imported })
  }

  const batch = getBatchById(params.batchId)
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

  return NextResponse.json({ batch })
}
