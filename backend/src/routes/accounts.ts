import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin } from '../middleware/auth'
import { getAccountBalance } from '../services/ledger'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

export const accountsRouter = Router()
accountsRouter.use(authRequired)

accountsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const list = await prisma.account.findMany({ orderBy: { code: 'asc' } })
    return ok(res, {
      list: list.map((a) => ({
        id: a.id,
        code: a.code,
        name_ar: a.nameAr,
        name_en: a.nameEn,
        parent_id: a.parentId,
        account_level: a.accountLevel,
        financial_statement: a.financialStatement,
      })),
    })
  }),
)

accountsRouter.get(
  '/sub',
  asyncHandler(async (_req, res) => {
    const list = await prisma.account.findMany({
      where: { accountLevel: 'فرعي' },
      orderBy: { code: 'asc' },
    })
    return ok(res, {
      list: list.map((a) => ({
        id: a.id,
        code: a.code,
        name_ar: a.nameAr,
        name_en: a.nameEn,
        parent_id: a.parentId,
        account_level: a.accountLevel,
      })),
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

accountsRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        code: z.string().min(1),
        name_ar: z.string().min(1),
        name_en: z.string().nullable().optional(),
        parent_id: z.number().nullable().optional(),
        account_level: z.enum(['رئيسي', 'فرعي']),
        financial_statement: z.string().nullable().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const account = await prisma.account.create({
      data: {
        code: body.data.code,
        nameAr: body.data.name_ar,
        nameEn: body.data.name_en ?? null,
        parentId: body.data.parent_id ?? null,
        accountLevel: body.data.account_level,
        financialStatement: body.data.financial_statement ?? null,
      },
    })
    return ok(res, { account }, 201)
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

