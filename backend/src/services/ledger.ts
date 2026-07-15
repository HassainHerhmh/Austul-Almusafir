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

const TICKET_REVENUE_CODE = '41'

async function getTicketRevenueAccountId() {
  const acc =
    (await prisma.account.findFirst({ where: { code: TICKET_REVENUE_CODE } })) ||
    (await prisma.account.findFirst({ where: { nameAr: 'إيرادات التذاكر' } }))
  return acc?.id ?? null
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
  const revenueId = await getTicketRevenueAccountId()
  if (!revenueId || input.amount <= 0) return

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
        accountId: revenueId,
        debit: 0,
        credit: input.amount,
        notes,
      },
    ],
  })
}

export async function reverseBookingCharge(bookingId: string) {
  const ref = bookingRefId(bookingId)
  await prisma.journalLine.deleteMany({
    where: { referenceType: 'booking', referenceId: ref },
  })
}
