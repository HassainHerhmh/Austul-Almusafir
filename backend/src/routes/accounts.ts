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

/** حساب قابل للترحيل: فرعي، أو له أب وليس أباً لحساب آخر */
async function listPostableAccounts() {
  const all = await prisma.account.findMany({ orderBy: { code: 'asc' } })
  const parentIds = new Set(
    all.map((a) => a.parentId).filter((id): id is number => id != null),
  )

  const postable = all.filter(
    (a) =>
      a.accountLevel === 'فرعي' ||
      (a.parentId != null && !parentIds.has(a.id)),
  )

  // أصلح المستوى إن كان حساباً ورقياً ومصنّفاً خطأً كرئيسي
  for (const a of postable) {
    if (a.accountLevel !== 'فرعي' && a.parentId != null && !parentIds.has(a.id)) {
      await prisma.account.update({
        where: { id: a.id },
        data: { accountLevel: 'فرعي' },
      })
      a.accountLevel = 'فرعي'
    }
  }

  return postable
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
    let level = body.data.account_level ?? (parentId ? 'فرعي' : 'رئيسي')
    if (parentId) level = 'فرعي'

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
    let level =
      body.data.account_level !== undefined
        ? body.data.account_level
        : prev.accountLevel
    if (parentId) level = 'فرعي'

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
