import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin } from '../middleware/auth'
import { getAccountBalance } from '../services/ledger'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

export const accountsRouter = Router()
accountsRouter.use(authRequired)

function mapAccount(
  a: {
    id: number
    code: string
    nameAr: string
    nameEn: string | null
    parentId: number | null
    accountLevel: string
    financialStatement: string | null
    createdAt?: Date
  },
  parentName?: string | null,
) {
  return {
    id: a.id,
    code: a.code,
    name_ar: a.nameAr,
    name_en: a.nameEn,
    parent_id: a.parentId,
    parent_name: parentName ?? null,
    account_level: a.accountLevel,
    financial_statement: a.financialStatement,
    created_at: a.createdAt?.toISOString?.() ?? undefined,
  }
}

/** حساب قابل للترحيل: المستوى فرعي فقط (الأب تحت الأب يبقى رئيسي ولا يُرحَّل عليه) */
async function listPostableAccounts() {
  const all = await prisma.account.findMany({ orderBy: { code: 'asc' } })
  const postable = all.filter((a) => a.accountLevel === 'فرعي')

  // إزالة التكرار بنفس الكود (تظهر مرة واحدة في قوائم السندات)
  const seenCodes = new Set<string>()
  const unique: typeof postable = []
  for (const a of postable) {
    if (seenCodes.has(a.code)) continue
    seenCodes.add(a.code)
    unique.push(a)
  }
  return unique
}

accountsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const list = await prisma.account.findMany({ orderBy: { code: 'asc' } })
    const byId = new Map(list.map((a) => [a.id, a]))
    return ok(res, {
      list: list.map((a) =>
        mapAccount(a, a.parentId ? byId.get(a.parentId)?.nameAr ?? null : null),
      ),
    })
  }),
)

accountsRouter.get(
  '/sub',
  asyncHandler(async (_req, res) => {
    const list = await listPostableAccounts()
    const all = await prisma.account.findMany()
    const byId = new Map(all.map((a) => [a.id, a]))
    return ok(res, {
      list: list.map((a) =>
        mapAccount(a, a.parentId ? byId.get(a.parentId)?.nameAr ?? null : null),
      ),
    })
  }),
)

accountsRouter.get(
  '/journal-lines',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === 'string' && req.query.from ? req.query.from : null
    const to = typeof req.query.to === 'string' && req.query.to ? req.query.to : null
    const accountIdRaw = typeof req.query.accountId === 'string' ? Number(req.query.accountId) : NaN
    const accountId = Number.isFinite(accountIdRaw) && accountIdRaw > 0 ? accountIdRaw : null
    const typesRaw = typeof req.query.types === 'string' ? req.query.types : ''
    const types = typesRaw
      ? typesRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : null

    const dateWhere =
      from && to
        ? { journalDate: { gte: from, lte: to } }
        : to
          ? { journalDate: { lte: to } }
          : from
            ? { journalDate: { gte: from } }
            : {}

    const lines = await prisma.journalLine.findMany({
      where: {
        ...dateWhere,
        ...(accountId ? { accountId } : {}),
        ...(types?.length ? { referenceType: { in: types } } : {}),
      },
      include: { account: true },
      orderBy: [{ journalDate: 'desc' }, { id: 'desc' }],
      take: 1000,
    })

    const label = (t: string) => {
      switch (t) {
        case 'booking':
          return 'تذكرة'
        case 'booking_commission':
          return 'عمولة'
        case 'admin_settlement':
          return 'تسديد (أدمن)'
        case 'manual_journal':
          return 'سند قيد'
        default:
          return t
      }
    }

    return ok(res, {
      count: lines.length,
      list: lines.map((l) => ({
        id: l.id,
        journal_date: l.journalDate,
        account_id: l.accountId,
        account_code: l.account.code,
        account_name: l.account.nameAr,
        debit: l.debit,
        credit: l.credit,
        notes: l.notes,
        reference_type: l.referenceType,
        reference_id: l.referenceId,
        entry_label: label(l.referenceType),
        created_at: l.createdAt.toISOString(),
      })),
    })
  }),
)

accountsRouter.post(
  '/journal-manual',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        journal_date: z.string().min(1),
        amount: z.number().positive(),
        debit_account_id: z.number().int().positive(),
        credit_account_id: z.number().int().positive(),
        notes: z.string().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات القيد غير صالحة')
    if (body.data.debit_account_id === body.data.credit_account_id) {
      return fail(res, 'الحساب المدين والدائن يجب أن يختلفا')
    }

    const [debitAcc, creditAcc] = await Promise.all([
      prisma.account.findUnique({ where: { id: body.data.debit_account_id } }),
      prisma.account.findUnique({ where: { id: body.data.credit_account_id } }),
    ])
    if (!debitAcc || !creditAcc) return fail(res, 'أحد الحسابات غير موجود', 404)

    const ref = Math.abs(Date.now() % 2_000_000_000) || 1
    const notes = body.data.notes?.trim() || 'قيد يومي'
    await prisma.journalLine.createMany({
      data: [
        {
          referenceId: ref,
          referenceType: 'manual_journal',
          journalDate: body.data.journal_date,
          accountId: body.data.debit_account_id,
          debit: body.data.amount,
          credit: 0,
          notes,
        },
        {
          referenceId: ref,
          referenceType: 'manual_journal',
          journalDate: body.data.journal_date,
          accountId: body.data.credit_account_id,
          debit: 0,
          credit: body.data.amount,
          notes,
        },
      ],
    })

    return ok(res, { referenceId: ref }, 201)
  }),
)

accountsRouter.put(
  '/journal-manual/:ref',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const ref = Number(paramId(req, 'ref'))
    if (!ref) return fail(res, 'مرجع غير صالح')

    const body = z
      .object({
        journal_date: z.string().min(1),
        amount: z.number().positive(),
        debit_account_id: z.number().int().positive(),
        credit_account_id: z.number().int().positive(),
        notes: z.string().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات القيد غير صالحة')
    if (body.data.debit_account_id === body.data.credit_account_id) {
      return fail(res, 'الحساب المدين والدائن يجب أن يختلفا')
    }

    const existing = await prisma.journalLine.count({
      where: { referenceId: ref, referenceType: 'manual_journal' },
    })
    if (!existing) return fail(res, 'القيد غير موجود', 404)

    const [debitAcc, creditAcc] = await Promise.all([
      prisma.account.findUnique({ where: { id: body.data.debit_account_id } }),
      prisma.account.findUnique({ where: { id: body.data.credit_account_id } }),
    ])
    if (!debitAcc || !creditAcc) return fail(res, 'أحد الحسابات غير موجود', 404)

    const notes = body.data.notes?.trim() || 'قيد يومي'
    await prisma.$transaction([
      prisma.journalLine.deleteMany({
        where: { referenceId: ref, referenceType: 'manual_journal' },
      }),
      prisma.journalLine.createMany({
        data: [
          {
            referenceId: ref,
            referenceType: 'manual_journal',
            journalDate: body.data.journal_date,
            accountId: body.data.debit_account_id,
            debit: body.data.amount,
            credit: 0,
            notes,
          },
          {
            referenceId: ref,
            referenceType: 'manual_journal',
            journalDate: body.data.journal_date,
            accountId: body.data.credit_account_id,
            debit: 0,
            credit: body.data.amount,
            notes,
          },
        ],
      }),
    ])

    return ok(res, { referenceId: ref })
  }),
)

accountsRouter.delete(
  '/journal-manual/:ref',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const ref = Number(paramId(req, 'ref'))
    if (!ref) return fail(res, 'مرجع غير صالح')
    const result = await prisma.journalLine.deleteMany({
      where: { referenceId: ref, referenceType: 'manual_journal' },
    })
    if (!result.count) return fail(res, 'القيد غير موجود', 404)
    return ok(res, { deleted: result.count })
  }),
)

accountsRouter.get(
  '/:id/balance',
  asyncHandler(async (req, res) => {
    const id = Number(paramId(req))
    if (!id) return fail(res, 'معرّف غير صالح')
    const balance = await getAccountBalance(id)
    return ok(res, { balance, accountId: id })
  }),
)

const accountBody = z.object({
  code: z.string().min(1).optional(),
  name_ar: z.string().min(1),
  name_en: z.string().nullable().optional(),
  parent_id: z.number().nullable().optional(),
  account_level: z.enum(['رئيسي', 'فرعي']).optional(),
  financial_statement: z.string().nullable().optional(),
})

accountsRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = accountBody.safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const parentId = body.data.parent_id ?? null
    const level =
      body.data.account_level ?? (parentId ? 'فرعي' : 'رئيسي')

    if (level === 'فرعي' && !parentId) {
      return fail(res, 'الحساب الفرعي يجب أن يرتبط بحساب أب')
    }

    let code = body.data.code
    if (!code) {
      if (parentId) {
        const parent = await prisma.account.findUnique({ where: { id: parentId } })
        const siblings = await prisma.account.count({ where: { parentId } })
        code = `${parent?.code ?? ''}${String(siblings + 1).padStart(2, '0')}`
      } else {
        const roots = await prisma.account.count({ where: { parentId: null } })
        code = String(roots + 1)
      }
    }

    const existing = await prisma.account.findUnique({ where: { code } })
    if (existing) return fail(res, 'رقم الحساب مستخدم مسبقاً', 409)

    const account = await prisma.account.create({
      data: {
        code,
        nameAr: body.data.name_ar,
        nameEn: body.data.name_en ?? null,
        parentId,
        accountLevel: level,
        financialStatement: body.data.financial_statement ?? null,
      },
    })
    const parent = parentId
      ? await prisma.account.findUnique({ where: { id: parentId } })
      : null
    return ok(res, { account: mapAccount(account, parent?.nameAr ?? null) }, 201)
  }),
)

accountsRouter.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(paramId(req))
    if (!id) return fail(res, 'معرّف غير صالح')
    const body = accountBody.safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const prev = await prisma.account.findUnique({ where: { id } })
    if (!prev) return fail(res, 'الحساب غير موجود', 404)

    const parentId =
      body.data.parent_id !== undefined ? body.data.parent_id : prev.parentId
    const level =
      body.data.account_level !== undefined
        ? body.data.account_level
        : prev.accountLevel

    if (level === 'فرعي' && !parentId) {
      return fail(res, 'الحساب الفرعي يجب أن يرتبط بحساب أب')
    }

    if (body.data.code && body.data.code !== prev.code) {
      const clash = await prisma.account.findUnique({ where: { code: body.data.code } })
      if (clash) return fail(res, 'رقم الحساب مستخدم مسبقاً', 409)
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        code: body.data.code ?? prev.code,
        nameAr: body.data.name_ar,
        nameEn: body.data.name_en !== undefined ? body.data.name_en : prev.nameEn,
        parentId,
        accountLevel: level,
        financialStatement:
          body.data.financial_statement !== undefined
            ? body.data.financial_statement
            : prev.financialStatement,
      },
    })
    const parent = account.parentId
      ? await prisma.account.findUnique({ where: { id: account.parentId } })
      : null
    return ok(res, { account: mapAccount(account, parent?.nameAr ?? null) })
  }),
)

accountsRouter.get(
  '/statement/:id',
  asyncHandler(async (req, res) => {
    const accountId = Number(paramId(req))
    const lines = await prisma.journalLine.findMany({
      where: { accountId },
      orderBy: [{ journalDate: 'asc' }, { id: 'asc' }],
      include: { account: true },
    })
    let balance = 0
    const list = lines.map((l) => {
      balance += l.debit - l.credit
      return {
        id: l.id,
        journal_date: l.journalDate,
        account_name: l.account.nameAr,
        debit: l.debit,
        credit: l.credit,
        balance,
        notes: l.notes,
        reference_type: l.referenceType,
        reference_id: l.referenceId,
      }
    })
    return ok(res, { list })
  }),
)
