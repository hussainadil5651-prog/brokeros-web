import { readAllLoads, type ParsedLoad, parseCurrency } from './google-sheets'

export type LoadStatus = 'quote' | 'booked' | 'dispatched' | 'in_transit' | 'delivered' | 'invoiced' | 'paid'

export interface Carrier {
  id: string
  mcNumber: string
  companyName: string
  contactName: string
  phone: string
  email: string
  equipmentTypes: string[]
  lanes: string[]
  insuranceExpiry: string | null
  insuranceStatus: 'valid' | 'expiring_soon' | 'expired' | 'unknown'
  rating: number
  notes: string
  createdAt: string
}

export interface Load {
  id: string
  loadNumber: string
  customerName: string
  customerId: string
  carrierId: string
  carrierName: string
  pickUpLocation: string
  pickUpDate: string
  deliveryLocation: string
  deliveryDate: string
  commodity: string
  weight: string
  equipmentType: string
  rate: number
  carrierCost: number
  profit: number
  marginPct: number
  status: LoadStatus
  invoiceId: string | null
  bookedBy: string
  notes: string
  createdAt: string
  company: 'CW' | 'ST'
  invoiceStatus: string
  _sheetRow: number
  _sheetTab: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  loadId: string
  loadNumber: string
  customerName: string
  amount: number
  status: 'unpaid' | 'paid' | 'partial'
  paidDate: string | null
  payoutPct: number
  expectedPayout: number
  payoutDate: string | null
  payoutStatus: 'pending' | 'paid'
  payrollCycle: { start: string; end: string } | null
  createdAt: string
}

const STATUS_ORDER: LoadStatus[] = ['quote', 'booked', 'dispatched', 'in_transit', 'delivered', 'invoiced', 'paid']

// Map sheet status text to our normalized LoadStatus
function mapStatus(sheetStatus: string): LoadStatus {
  const s = sheetStatus.toLowerCase().trim()
  if (s.includes('paid') || s === 'paid') return 'paid'
  if (s.includes('invoiced')) return 'invoiced'
  if (s.includes('delivered') || s.includes('deliverd')) return 'delivered'
  if (s.includes('in transit') || s.includes('intransit')) return 'in_transit'
  if (s.includes('dispatched')) return 'dispatched'
  if (s.includes('booked')) return 'booked'
  return 'quote'
}

export function getNextStatus(current: LoadStatus): LoadStatus | null {
  const idx = STATUS_ORDER.indexOf(current)
  if (idx === -1 || idx >= STATUS_ORDER.length - 1) return null
  return STATUS_ORDER[idx + 1]
}

export function getStatusIndex(status: LoadStatus): number {
  return STATUS_ORDER.indexOf(status)
}

function mapInvoiceStatus(sheetInvStatus: string): 'cleared' | 'unpaid' {
  const s = sheetInvStatus.toLowerCase()
  if (s.includes('cleared') || s.includes('paid')) return 'cleared'
  return 'unpaid'
}

let cachedLoads: Load[] | null = null
let lastFetch = 0
const CACHE_TTL = 300_000

export async function refreshFromSheet(): Promise<Load[]> {
  const parsed = await readAllLoads()

  const loads: Load[] = parsed.map((p, i) => ({
    id: `load-${p.proNo}`,
    loadNumber: p.proNo,
    customerName: p.customerName,
    customerId: `cust-${p.proNo}`,
    carrierId: `car-${p.mcNumber || i}`,
    carrierName: p.carrierName,
    pickUpLocation: p.pickUpLocation,
    pickUpDate: p.pickUpDate,
    deliveryLocation: p.deliveryLocation,
    deliveryDate: '',
    commodity: '',
    weight: '',
    equipmentType: p.mode,
    rate: p.rate,
    carrierCost: p.carrierCost,
    profit: p.profit,
    marginPct: p.rate > 0 ? Math.round((p.profit / p.rate) * 100) : 0,
    status: mapStatus(p.status),
    invoiceId: null,
    invoiceStatus: p.invoiceStatus,
    bookedBy: '',
    notes: '',
    createdAt: new Date().toISOString(),
    company: p.company,
    _sheetRow: p._sheetRow,
    _sheetTab: p._sheetTab,
  }))

  cachedLoads = loads
  lastFetch = Date.now()
  return loads
}

export async function getLoads(): Promise<Load[]> {
  if (!cachedLoads || Date.now() - lastFetch > CACHE_TTL) {
    return refreshFromSheet()
  }
  return cachedLoads
}

export async function getLoadsByStatus(status: LoadStatus): Promise<Load[]> {
  const all = await getLoads()
  return all.filter((l) => l.status === status)
}

export async function getLoadById(id: string): Promise<Load | null> {
  const all = await getLoads()
  return all.find((l) => l.id === id) ?? null
}

export function extractCarriers(loads: Load[]): Carrier[] {
  const seen = new Map<string, Carrier>()
  let counter = 0
  for (const l of loads) {
    if (!l.carrierName || seen.has(l.carrierName)) continue
    counter++
    seen.set(l.carrierName, {
      id: `car-${counter}`,
      mcNumber: '',
      companyName: l.carrierName,
      contactName: '',
      phone: '',
      email: '',
      equipmentTypes: l.equipmentType ? [l.equipmentType] : [],
      lanes: [],
      insuranceExpiry: null,
      insuranceStatus: 'unknown',
      rating: 3,
      notes: '',
      createdAt: new Date().toISOString(),
    })
  }
  return Array.from(seen.values())
}

export async function getCarriers(): Promise<Carrier[]> {
  const loads = await getLoads()
  return extractCarriers(loads)
}

function addDays(dateStr: string, days: number): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

const PAYROLL_EPOCH = new Date('2025-01-03')
const MS_PER_DAY = 86400000
const CYCLE_DAYS = 14

function getCycleIndex(date: Date): number {
  return Math.floor((date.getTime() - PAYROLL_EPOCH.getTime()) / (MS_PER_DAY * CYCLE_DAYS))
}

function getNextFortnightlyPayoutDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  const ci = getCycleIndex(d)
  const payout = new Date(PAYROLL_EPOCH.getTime() + (ci + 1) * CYCLE_DAYS * MS_PER_DAY)
  return payout.toISOString().split('T')[0]
}

function getPayrollCycle(dateStr: string): { start: string; end: string } {
  if (!dateStr) return { start: '', end: '' }
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return { start: '', end: '' }
  const ci = getCycleIndex(d)
  const start = new Date(PAYROLL_EPOCH.getTime() + ci * CYCLE_DAYS * MS_PER_DAY)
  const end = new Date(PAYROLL_EPOCH.getTime() + (ci + 1) * CYCLE_DAYS * MS_PER_DAY - MS_PER_DAY)
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
}

export function extractInvoices(loads: Load[]): Invoice[] {
  const today = todayStr()
  let invCounter = 0
  return loads
    .filter((l) => l.status === 'delivered' || l.status === 'invoiced' || l.status === 'paid')
    .map((l) => {
      invCounter++
      const invCleared = l.invoiceStatus?.toLowerCase().includes('cleared')
      const payrollCycle = l.deliveryDate ? getPayrollCycle(l.deliveryDate) : null
      const fortnightlyPayoutDate = payrollCycle ? payrollCycle.end : null
      const isPastPayroll = !!fortnightlyPayoutDate && fortnightlyPayoutDate <= today
      const payoutAmount = Math.round(l.rate * 0.65)
      return {
        id: `inv-${l.loadNumber}`,
        invoiceNumber: `INV-${l.loadNumber}`,
        loadId: l.id,
        loadNumber: l.loadNumber,
        customerName: l.customerName,
        amount: l.rate,
        status: invCleared ? 'paid' as const : 'unpaid' as const,
        paidDate: invCleared ? today : null,
        payoutPct: 65,
        expectedPayout: payoutAmount,
        payoutDate: fortnightlyPayoutDate,
        payoutStatus: invCleared || isPastPayroll ? 'paid' as const : 'pending' as const,
        payrollCycle,
        createdAt: l.pickUpDate || today,
      }
    })
}

export async function getInvoices(): Promise<Invoice[]> {
  const loads = await getLoads()
  return extractInvoices(loads)
}

export async function getPayoutForecast(): Promise<{
  totalExpected: number; totalPaid: number; pendingCount: number; paidCount: number
  nextPayoutDate: string; nextPayoutAmount: number; currentPayrollCycle: { start: string; end: string } | null
}> {
  const invoices = await getInvoices()
  const unpaidInvoices = invoices.filter((i) => i.status !== 'paid')
  const totalExpected = unpaidInvoices.reduce((s, i) => s + i.expectedPayout, 0)
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.expectedPayout, 0)
  const pendingCount = unpaidInvoices.length
  const paidCount = invoices.filter((i) => i.status === 'paid').length
  const today = todayStr()
  const currentPayrollCycle = getPayrollCycle(today)
  let nextPayoutDate = currentPayrollCycle.end || '—'
  let nextPayoutAmount = 0
  const currentCycleInvoices = invoices.filter(i =>
    i.status !== 'paid' && i.payrollCycle &&
    i.payrollCycle.start === currentPayrollCycle.start &&
    i.payrollCycle.end === currentPayrollCycle.end
  )
  nextPayoutAmount = currentCycleInvoices.reduce((s, i) => s + i.expectedPayout, 0)
  return { totalExpected, totalPaid, pendingCount, paidCount, nextPayoutDate, nextPayoutAmount, currentPayrollCycle }
}

export function invalidateCache(): void {
  cachedLoads = null
  lastFetch = 0
}
