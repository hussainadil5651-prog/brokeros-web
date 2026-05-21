export interface Batch {
  id: string
  batchDate: string
  batchNumber: number
  emails: string[]
  assignedTo: string
  status: 'pending' | 'in_progress' | 'completed'
  totalEmails: number
  createdAt: string
}

export interface BatchSummary {
  id: string
  batchDate: string
  batchNumber: number
  assignedTo: string
  status: Batch['status']
  totalEmails: number
  createdAt: string
}

export function findEmailColumn(headers: string[], sampleRows: string[][]): number {
  const candidates: { index: number; score: number }[] = []

  for (let col = 0; col < (headers.length || 5); col++) {
    let score = 0
    const checkLabel = (headers[col] || '').toLowerCase()
    if (/email/i.test(checkLabel)) score += 10
    if (/e-?mail/i.test(checkLabel)) score += 5
    if (/@/.test(checkLabel)) score += 3

    for (let r = 0; r < Math.min(sampleRows.length, 5); r++) {
      const cell = (sampleRows[r]?.[col] || '').trim()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell)) {
        score += 3
      } else if (/@/.test(cell)) {
        score += 1
      }
    }

    candidates.push({ index: col, score })
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]?.index ?? 0
}

export function extractEmails(rows: string[][], emailCol: number): string[] {
  const seen = new Set<string>()

  for (const row of rows) {
    const cell = (row[emailCol] || '').trim()
    if (!cell) continue

    if (/^[\d\s\-\(\)\.\+]+$/.test(cell)) continue

    const parts = cell.split(/[\/\\\n;,|]+/)
    for (const part of parts) {
      const cleaned = part.replace(/\s+/g, '').toLowerCase()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) && cleaned.length < 100) {
        seen.add(cleaned)
      }
    }
  }

  return Array.from(seen)
}

export function createBatches(
  emails: string[],
  batchSize: number = 30,
  date: string,
  assignedTo: string,
): Batch[] {
  const batches: Batch[] = []
  const totalBatches = Math.ceil(emails.length / batchSize)

  for (let i = 0; i < emails.length; i += batchSize) {
    const batchEmails = emails.slice(i, i + batchSize)
    const batchNumber = Math.floor(i / batchSize) + 1
    batches.push({
      id: `batch-${date}-${batchNumber}`,
      batchDate: date,
      batchNumber,
      emails: batchEmails,
      assignedTo,
      status: 'pending',
      totalEmails: batchEmails.length,
      createdAt: new Date().toISOString(),
    })
  }

  return batches
}

const RAW_EMAIL_SAMPLE = [
  'deyhq@deydistributing.com',
  'shipping@galco.com',
  'mgproduce@hotmail.com',
  'warehouse@tripifoods.com',
  'raymondg@lafmusic.com',
  'questions.flemingrepair@gmail.com',
  'info@Southpawguitars.com',
  'CONTACT@STRAITMUSIC.COM',
  'INFO@STEINWAYOFAUSTIN.COM',
  'tricityequip@aol.com',
  'office@teampetroleum.com',
  'lfriedrich@etiglobal.com',
  'amship@msn.com',
  'davidb@metal-distributors.com',
  'brad@hearthsidehomeinspections.com',
  'sales@aircrafttool.com',
  'nathan@americanautomotivelighting.com',
  'craig@tandemtools.com',
  'monty@montygray.com',
  'mitch@myerswoodproducts.com',
  'service@syntechintl.biz',
  'ian@moscowfood.coop',
  'growertom@hotmail.com',
  'sales@dietrichscarepackage.com',
  'tracycnc@hotmail.com',
  'orderdepartment@elitecomfort.com',
  'office@randolphpool.com',
  'dbeckman@imperial-surgical.com',
  'hillsidegrowers@frontiernet.net',
  'andrew@ambientepr.com',
  'jim@jfksmokefree.com',
  'carolyn@northstargrowers.com',
  'bobh@tricountytool.net',
  'sales@lakeareafireplace.com',
  'richard@shastasoot.com',
  'wholesale@michiganlumber.com',
  'info@bigeastern.com',
  'tracy@fullcirclecompost.com',
  'nick@nwbench.com',
  'repairs@transworldtruck.com',
  'dispatch@mctranslog.com',
  'logistics@freightwaveinc.com',
  'broker@loadmatch.com',
  'carriers@usfreight.com',
  'sales@shipcraftlogistics.com',
  'ops@elitetransportllc.com',
  'quotes@freightnest.com',
  'dispatcher@roadhawg.com',
  'solutions@cargomasters.net',
  'freight@shiptekinc.com',
  'coordinator@logisticpro.com',
  'rates@transglobal.com',
  'booking@freightpulse.com',
  'support@truckerpath.com',
  'hello@dispatchsimple.com',
  'team@loadboardpro.com',
  'admin@carrierconnect.com',
  'info@brokerhub.com',
  'contact@shiplogix.com',
  'dispatch@vanexpress.com',
  'operations@flatbedfreight.com',
  'service@reeferdirect.com',
  'sales@dryvanlogistics.com',
  'broker@loadsinc.com',
  'carrier@freightmate.com',
  'ops@transplus.com',
  'info@quickship.com',
  'dispatch@haulmaster.com',
  'logistics@roadrunner.com',
  'admin@freightzone.com',
  'sales@cargopro.com',
  'support@loadtracker.com',
  'hello@freightflow.com',
  'team@dispatchwise.com',
  'contact@brokerconnect.com',
  'rates@freightquote.net',
  'ops@truckerpro.com',
  'admin@loadmanager.com',
  'dispatch@shiponline.com',
  'info@carrierzone.com',
  'service@freightway.com',
  'sales@logisticstoday.com',
  'broker@loadboard.net',
  'carrier@transdirect.com',
  'ops@flatbedexpress.com',
  'support@reeferpro.com',
  'hello@dryvaninc.com',
  'team@freightmasters.com',
  'contact@quickship.com',
  'rates@haulpro.com',
  'admin@loadrunner.com',
  'dispatch@trucklogix.com',
  'info@shipfast.com',
  'service@cargoline.com',
  'sales@transworldllc.com',
  'broker@freightnow.com',
  'carrier@loadconnect.com',
  'ops@dispatchpro.com',
]

function generateBatchEmails(count: number): string[] {
  const result: string[] = []
  for (let i = 0; i < count; i++) {
    const base = RAW_EMAIL_SAMPLE[i % RAW_EMAIL_SAMPLE.length]
    const [name, domain] = base.split('@')
    const suffix = Math.floor(i / RAW_EMAIL_SAMPLE.length)
    result.push(suffix === 0 ? base : `${name}+${suffix}@${domain}`)
  }
  return result
}

export function generateMockBatches(agentEmail: string): { batches: BatchSummary[] } {
  const today = new Date()
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const allBatches: BatchSummary[] = []

  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const d = new Date(today)
    d.setDate(d.getDate() + dayOffset)
    const dateStr = d.toISOString().split('T')[0]
    const dayName = daysOfWeek[d.getDay()]

    let emailCount = 0
    if (dayName === 'Monday') emailCount = 300
    else if (dayName === 'Tuesday') emailCount = 240
    else if (dayName === 'Wednesday') emailCount = 180
    else if (dayName === 'Thursday') emailCount = 210
    else if (dayName === 'Friday') emailCount = 150
    else emailCount = 0

    if (emailCount === 0) continue

    const emails = generateBatchEmails(emailCount)
    const batches = createBatches(emails, 30, dateStr, agentEmail)

    for (const b of batches) {
      allBatches.push({
        id: b.id,
        batchDate: b.batchDate,
        batchNumber: b.batchNumber,
        assignedTo: b.assignedTo,
        status: b.status,
        totalEmails: b.totalEmails,
        createdAt: b.createdAt,
      })
    }
  }

  return { batches: allBatches }
}

export function getBatchById(batchId: string): Batch | null {
  const parts = batchId.split('-')
  if (parts.length < 3) return null
  const batchNumber = parseInt(parts[parts.length - 1], 10)
  const dateParts = parts.slice(1, parts.length - 1)
  const dateStr = dateParts.join('-')

  const dayName = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })

  let emailCount = 0
  if (dayName === 'Monday') emailCount = 300
  else if (dayName === 'Tuesday') emailCount = 240
  else if (dayName === 'Wednesday') emailCount = 180
  else if (dayName === 'Thursday') emailCount = 210
  else if (dayName === 'Friday') emailCount = 150

  const emails = generateBatchEmails(emailCount)
  const start = (batchNumber - 1) * 30
  const batchEmails = emails.slice(start, start + 30)

  if (batchEmails.length === 0) return null

  return {
    id: batchId,
    batchDate: dateStr,
    batchNumber,
    emails: batchEmails,
    assignedTo: 'omar@afadispatch.com',
    status: 'pending',
    totalEmails: batchEmails.length,
    createdAt: new Date(dateStr + 'T00:00:00').toISOString(),
  }
}
