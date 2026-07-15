import { prisma } from '../config'

/** رصيد ذمم المكتب (مدين − دائن) = ما على المكتب لدى الوكالة */
export async function getAccountBalance(accountId: number | null | undefined) {
  if (!accountId) return 0
  const rows = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: { accountId },
    _sum: { debit: true, credit: true },
  })
  const sum = rows[0]?._sum
  return (sum?.debit ?? 0) - (sum?.credit ?? 0)
}

function bookingRefId(bookingId: string): number {
  let h = 2166136261
  for (let i = 0; i < bookingId.length; i++) {
    h ^= bookingId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) || 1
}

const TICKET_TRANSIT_CODE = '1132'
const TICKET_TRANSIT_NAME = 'وسيط إيراد التذاكر'
const COMMISSION_EXPENSE_CODE = '53'
const COMMISSION_EXPENSE_NAME = 'عمولات المكاتب'

type TransitSettings = {
  office_commissions_account?: number | null
  ticket_revenue_account?: number | null
}

async function readTransitSettings(): Promise<TransitSettings> {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'transit_accounts' } })
  return (setting?.value as TransitSettings | null) ?? {}
}

/** حساب وسيط إيراد التذاكر — دائن قيد الحجز (مقابل مدين المكتب) */
export async function ensureTicketRevenueTransitAccount() {
  const configuredId = (await readTransitSettings()).ticket_revenue_account
  if (configuredId) {
    const configured = await prisma.account.findUnique({ where: { id: configuredId } })
    if (configured) return configured.id
  }

  const existing =
    (await prisma.account.findFirst({ where: { code: TICKET_TRANSIT_CODE } })) ||
    (await prisma.account.findFirst({ where: { nameAr: TICKET_TRANSIT_NAME } }))

  if (existing) return existing.id

  const receivables = await prisma.account.findFirst({ where: { code: '113' } })
  const row = await prisma.account.create({
    data: {
      code: TICKET_TRANSIT_CODE,
      nameAr: TICKET_TRANSIT_NAME,
      nameEn: 'Ticket Revenue Transit',
      parentId: receivables?.id ?? null,
      accountLevel: 'فرعي',
      financialStatement: 'الميزانية العمومية',
    },
  })
  return row.id
}

/** مصروف عمولات المكاتب — تحت المصروفات (أرباح وخسائر) */
export async function ensureCommissionsTransitAccount() {
  const configuredId = (await readTransitSettings()).office_commissions_account
  if (configuredId) {
    const configured = await prisma.account.findUnique({ where: { id: configuredId } })
    if (configured) return configured.id
  }

  const existing =
    (await prisma.account.findFirst({ where: { code: COMMISSION_EXPENSE_CODE } })) ||
    (await prisma.account.findFirst({ where: { nameAr: COMMISSION_EXPENSE_NAME } }))

  if (existing) return existing.id

  const expenses = await prisma.account.findFirst({ where: { code: '5' } })
  const row = await prisma.account.create({
    data: {
      code: COMMISSION_EXPENSE_CODE,
      nameAr: COMMISSION_EXPENSE_NAME,
      nameEn: 'Office Commissions Expense',
      parentId: expenses?.id ?? null,
      accountLevel: 'فرعي',
      financialStatement: 'أرباح وخسائر',
    },
  })
  return row.id
}

export async function ensureOfficeLedgerAccount(officeName: string) {
  let parent = await prisma.account.findFirst({ where: { code: '1131' } })
  if (!parent) {
    const receivables = await prisma.account.findFirst({ where: { code: '113' } })
    parent = await prisma.account.create({
      data: {
        code: '1131',
        nameAr: 'ذمم مكاتب السفريات',
        nameEn: 'Travel Offices Receivables',
        parentId: receivables?.id ?? null,
        accountLevel: 'رئيسي',
        financialStatement: 'الميزانية العمومية',
      },
    })
  }

  const existing = await prisma.account.findFirst({
    where: { parentId: parent.id, nameAr: officeName },
  })
  if (existing) return existing.id

  const siblings = await prisma.account.count({ where: { parentId: parent.id } })
  const code = `1131${String(siblings + 1).padStart(2, '0')}`
  const row = await prisma.account.create({
    data: {
      code,
      nameAr: officeName,
      nameEn: officeName,
      parentId: parent.id,
      accountLevel: 'فرعي',
      financialStatement: 'الميزانية العمومية',
    },
  })
  return row.id
}

export async function postBookingCharge(input: {
  bookingId: string
  ledgerAccountId: number
  amount: number
  passengerName: string
  seatNumber: number
}) {
  /** مدين: حساب الوكيل · دائن: وسيط إيراد التذاكر */
  const revenueTransitId = await ensureTicketRevenueTransitAccount()
  if (!revenueTransitId || input.amount <= 0) return

  const ref = bookingRefId(input.bookingId)
  const exists = await prisma.journalLine.findFirst({
    where: { referenceType: 'booking', referenceId: ref },
  })
  if (exists) return

  const journalDate = new Date().toISOString().slice(0, 10)
  const notes = `حجز ${input.passengerName} — مقعد ${input.seatNumber}`

  await prisma.journalLine.createMany({
    data: [
      {
        referenceId: ref,
        referenceType: 'booking',
        journalDate,
        accountId: input.ledgerAccountId,
        debit: input.amount,
        credit: 0,
        notes,
      },
      {
        referenceId: ref,
        referenceType: 'booking',
        journalDate,
        accountId: revenueTransitId,
        debit: 0,
        credit: input.amount,
        notes,
      },
    ],
  })
}

/**
 * قيد العمولة: من حـ/ مصروف عمولات المكاتب (مدين) إلى حـ/ ذمة المكتب (دائن)
 * فيظهر في أرباح وخسائر ويخفّض ما على المكتب بمقدار عمولته.
 */
export async function postBookingCommission(input: {
  bookingId: string
  ledgerAccountId: number
  commissionPercent: number
  ticketPrice: number
  passengerName: string
  seatNumber: number
}) {
  const percent = Number(input.commissionPercent) || 0
  if (percent <= 0 || input.ticketPrice <= 0) return

  const amount = Math.round(((input.ticketPrice * percent) / 100) * 100) / 100
  if (amount <= 0) return

  const transitId = await ensureCommissionsTransitAccount()
  const ref = bookingRefId(input.bookingId)
  const exists = await prisma.journalLine.findFirst({
    where: { referenceType: 'booking_commission', referenceId: ref },
  })
  if (exists) return

  const journalDate = new Date().toISOString().slice(0, 10)
  const notes = `عمولة ${percent}% — حجز ${input.passengerName} — مقعد ${input.seatNumber}`

  await prisma.journalLine.createMany({
    data: [
      {
        referenceId: ref,
        referenceType: 'booking_commission',
        journalDate,
        accountId: transitId,
        debit: amount,
        credit: 0,
        notes,
      },
      {
        referenceId: ref,
        referenceType: 'booking_commission',
        journalDate,
        accountId: input.ledgerAccountId,
        debit: 0,
        credit: amount,
        notes,
      },
    ],
  })
}

export async function reverseBookingCharge(bookingId: string) {
  const ref = bookingRefId(bookingId)
  await prisma.journalLine.deleteMany({
    where: {
      referenceId: ref,
      referenceType: { in: ['booking', 'booking_commission'] },
    },
  })
}
