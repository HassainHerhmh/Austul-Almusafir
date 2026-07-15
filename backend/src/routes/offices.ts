import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin } from '../middleware/auth'
import { ensureOfficeLedgerAccount, getAccountBalance } from '../services/ledger'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

export const officesRouter = Router()

officesRouter.use(authRequired)

officesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user!.role !== 'admin' && req.user!.officeId) {
      const office = await prisma.office.findUnique({ where: { id: req.user!.officeId } })
      return ok(res, { list: office ? [office] : [] })
    }
    const list = await prisma.office.findMany({ orderBy: { createdAt: 'desc' } })
    return ok(res, { list })
  }),
)

officesRouter.get(
  '/:id/balance',
  asyncHandler(async (req, res) => {
    const office = await prisma.office.findUnique({ where: { id: paramId(req) } })
    if (!office) return fail(res, 'المكتب غير موجود', 404)
    if (req.user!.role !== 'admin' && req.user!.officeId !== office.id) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
    const balance = await getAccountBalance(office.ledgerAccountId)
    return ok(res, { balance, officeId: office.id })
  }),
)

officesRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        city: z.string().min(1),
        phone: z.string().min(1),
        status: z.enum(['active', 'suspended']).optional(),
        subscription: z.enum(['active', 'expired', 'trial']).optional(),
        ledgerAccountId: z.number().nullable().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    let ledgerAccountId = body.data.ledgerAccountId ?? null
    if (!ledgerAccountId) {
      ledgerAccountId = await ensureOfficeLedgerAccount(body.data.name)
    }

    const office = await prisma.office.create({
      data: {
        name: body.data.name,
        city: body.data.city,
        phone: body.data.phone,
        status: body.data.status ?? 'active',
        subscription: body.data.subscription ?? 'trial',
        ledgerAccountId,
      },
    })
    return ok(res, { office }, 201)
  }),
)

officesRouter.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.office.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'المكتب غير موجود', 404)

    const body = z
      .object({
        name: z.string().min(1).optional(),
        city: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
        status: z.enum(['active', 'suspended']).optional(),
        subscription: z.enum(['active', 'expired', 'trial']).optional(),
        ledgerAccountId: z.number().nullable().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    let ledgerAccountId = body.data.ledgerAccountId
    if (ledgerAccountId === undefined) ledgerAccountId = existing.ledgerAccountId
    if (!ledgerAccountId) {
      ledgerAccountId = await ensureOfficeLedgerAccount(body.data.name ?? existing.name)
    }

    const office = await prisma.office.update({
      where: { id: paramId(req) },
      data: {
        ...body.data,
        ledgerAccountId,
      },
    })
    return ok(res, { office })
  }),
)

