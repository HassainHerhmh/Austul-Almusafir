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

/** حساب وسيط إيراد التذاكر — يُستخدم الموجود فقط (لا إنشاء تلقائي) */
export async function resolveTicketRevenueTransitAccount(): Promise<number | null> {
  const configuredId = (await readTransitSettings()).ticket_revenue_account
  if (configuredId) {
    const configured = await prisma.account.findUnique({ where: { id: configuredId } })
    if (configured) return configured.id
  }

  const existing =
    (await prisma.account.findFirst({ where: { code: TICKET_TRANSIT_CODE } })) ||
    (await prisma.account.findFirst({ where: { nameAr: TICKET_TRANSIT_NAME } }))

  return existing?.id ?? null
}

/** @deprecated استخدم resolveTicketRevenueTransitAccount — لا ينشئ حسابات */
export async function ensureTicketRevenueTransitAccount() {
  const id = await resolveTicketRevenueTransitAccount()
  if (!id) {
    throw new Error('حساب وسيط إيراد التذاكر غير موجود — أضفه يدوياً من دليل الحسابات أو الحسابات الوسيطة')
  }
  return id
}

/** مصروف عمولات المكاتب — موجود فقط */
export async function resolveCommissionsTransitAccount(): Promise<number | null> {
  const configuredId = (await readTransitSettings()).office_commissions_account
  if (configuredId) {
    const configured = await prisma.account.findUnique({ where: { id: configuredId } })
    if (configured) return configured.id
  }

  const existing =
    (await prisma.account.findFirst({ where: { code: COMMISSION_EXPENSE_CODE } })) ||
    (await prisma.account.findFirst({ where: { nameAr: COMMISSION_EXPENSE_NAME } }))

  return existing?.id ?? null
}

/** @deprecated استخدم resolveCommissionsTransitAccount — لا ينشئ حسابات */
export async function ensureCommissionsTransitAccount() {
  const id = await resolveCommissionsTransitAccount()
  if (!id) {
    throw new Error('حساب عمولات المكاتب غير موجود — أضفه يدوياً من دليل الحسابات أو الحسابات الوسيطة')
  }
  return id
}

/** ربط ذمة مكتب موجود بالاسم فقط — بدون إنشاء */
export async function findOfficeLedgerAccount(officeName: string): Promise<number | null> {
  const parent = await prisma.account.findFirst({ where: { code: '1131' } })
  if (!parent) return null
  const existing = await prisma.account.findFirst({
    where: { parentId: parent.id, nameAr: officeName },
  })
  return existing?.id ?? null
}

/** @deprecated لا ينشئ حسابات بعد الآن */
export async function ensureOfficeLedgerAccount(officeName: string) {
  const id = await findOfficeLedgerAccount(officeName)
  if (!id) {
    throw new Error(
      `حساب ذمة المكتب «${officeName}» غير موجود — أنشئه يدوياً تحت ذمم مكاتب السفريات واربطه من إدارة المكاتب`,
    )
  }
  return id
}

export async function postBookingCharge(input: {
  bookingId: string
  ledgerAccountId: number
  amount: number
  passengerName: string
  seatNumber: number
}) {
  /** مدين: حساب الوكيل · دائن: وسيط إيراد التذاكر */
  const revenueTransitId = await resolveTicketRevenueTransitAccount()
  if (!revenueTransitId) {
    throw new Error(
      'حساب وسيط إيراد التذاكر غير موجود — أضفه يدوياً واضبطه من الحسابات الوسيطة',
    )
  }
  if (input.amount <= 0) return

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

  const transitId = await resolveCommissionsTransitAccount()
  if (!transitId) {
    throw new Error(
      'حساب عمولات المكاتب غير موجود — أضفه يدوياً واضبطه من الحسابات الوسيطة',
    )
  }
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

function voucherRefId(voucherId: string): number {
  return bookingRefId(`voucher:${voucherId}`)
}

async function resolveCashAccount(): Promise<number | null> {
  const existing =
    (await prisma.account.findFirst({ where: { code: '11101' } })) ||
    (await prisma.account.findFirst({ where: { nameAr: 'الصندوق الرئيسي' } }))
  return existing?.id ?? null
}

/**
 * تسديد/قبض من المكتب يُسجّله الأدمن فقط على كشف الذمة:
 * مدين الصندوق · دائن ذمة المكتب
 */
export async function postAdminOfficeSettlement(input: {
  voucherId: string
  ledgerAccountId: number
  amount: number
  description: string
  date: string
}) {
  if (input.amount <= 0) return

  const ref = voucherRefId(input.voucherId)
  const exists = await prisma.journalLine.findFirst({
    where: { referenceType: 'admin_settlement', referenceId: ref },
  })
  if (exists) return

  const cashId = await resolveCashAccount()
  if (!cashId) {
    throw new Error('حساب الصندوق الرئيسي غير موجود — أضفه يدوياً من دليل الحسابات')
  }
  const notes = input.description

  await prisma.journalLine.createMany({
    data: [
      {
        referenceId: ref,
        referenceType: 'admin_settlement',
        journalDate: input.date,
        accountId: cashId,
        debit: input.amount,
        credit: 0,
        notes,
      },
      {
        referenceId: ref,
        referenceType: 'admin_settlement',
        journalDate: input.date,
        accountId: input.ledgerAccountId,
        debit: 0,
        credit: input.amount,
        notes,
      },
    ],
  })
}

export type StatementLine = {
  id: number
  journal_date: string
  debit: number
  credit: number
  balance: number
  notes: string | null
  reference_type: string
  reference_id: number
  entry_label: string
}

function entryLabel(referenceType: string): string {
  switch (referenceType) {
    case 'booking':
      return 'تذكرة'
    case 'booking_commission':
      return 'عمولة'
    case 'admin_settlement':
      return 'تسديد (أدمن)'
    case 'manual_journal':
      return 'سند قيد'
    default:
      return referenceType
  }
}

const STATEMENT_TYPES = ['booking', 'booking_commission', 'admin_settlement'] as const

/** كشف حساب ذمة المكتب: تذاكر + عمولات + تسديدات الأدمن فقط */
export async function getOfficeLedgerStatement(input: {
  ledgerAccountId: number
  fromDate?: string | null
  toDate?: string | null
  types?: string[] | null
}) {
  const allowed = new Set<string>(STATEMENT_TYPES)
  const requested =
    input.types && input.types.length
      ? input.types.filter((t) => allowed.has(t))
      : [...STATEMENT_TYPES]
  const types = requested.length ? requested : [...STATEMENT_TYPES]
  const typeFilter = { referenceType: { in: types } }

  let openingBalance = 0
  if (input.fromDate) {
    const openingRows = await prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        accountId: input.ledgerAccountId,
        journalDate: { lt: input.fromDate },
        ...typeFilter,
      },
      _sum: { debit: true, credit: true },
    })
    const sum = openingRows[0]?._sum
    openingBalance = (sum?.debit ?? 0) - (sum?.credit ?? 0)
  }

  const dateWhere =
    input.fromDate && input.toDate
      ? { journalDate: { gte: input.fromDate, lte: input.toDate } }
      : input.toDate
        ? { journalDate: { lte: input.toDate } }
        : input.fromDate
          ? { journalDate: { gte: input.fromDate } }
          : {}

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId: input.ledgerAccountId,
      ...dateWhere,
      ...typeFilter,
    },
    orderBy: [{ journalDate: 'asc' }, { id: 'asc' }],
  })

  let balance = openingBalance
  const list: StatementLine[] = []

  if (input.fromDate && (openingBalance !== 0 || lines.length > 0)) {
    list.push({
      id: 0,
      journal_date: input.fromDate,
      debit: openingBalance > 0 ? openingBalance : 0,
      credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
      balance: openingBalance,
      notes: 'رصيد سابق',
      reference_type: 'opening',
      reference_id: 0,
      entry_label: 'رصيد سابق',
    })
  }

  for (const l of lines) {
    balance += l.debit - l.credit
    list.push({
      id: l.id,
      journal_date: l.journalDate,
      debit: l.debit,
      credit: l.credit,
      balance,
      notes: l.notes,
      reference_type: l.referenceType,
      reference_id: l.referenceId,
      entry_label: entryLabel(l.referenceType),
    })
  }

  return { list, openingBalance, closingBalance: balance }
}