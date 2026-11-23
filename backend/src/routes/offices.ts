import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin, requireRoles } from '../middleware/auth'
import { officeIdsForUser } from '../utils/branchScope'
import { getAccountBalance, getOfficeLedgerStatement } from '../services/ledger'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

export const officesRouter = Router()

officesRouter.use(authRequired)

officesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user!.role === 'branch_admin') {
      const scope = await officeIdsForUser(req.user!)
      const list = await prisma.office.findMany({
        where:
          scope === 'all'
            ? {}
            : { id: { in: scope as string[] } },
        orderBy: { createdAt: 'desc' },
        include: { branch: { select: { id: true, name: true } } },
      })
      return ok(res, {
        list: list.map((o) => ({
          ...o,
          branchName: o.branch?.name ?? null,
        })),
      })
    }
    if (req.user!.role !== 'admin' && req.user!.officeId) {
      const office = await prisma.office.findUnique({
        where: { id: req.user!.officeId },
        include: { branch: { select: { id: true, name: true } } },
      })
      return ok(res, {
        list: office
          ? [{ ...office, branchName: office.branch?.name ?? null }]
          : [],
      })
    }
    const list = await prisma.office.findMany({
      orderBy: { createdAt: 'desc' },
      include: { branch: { select: { id: true, name: true } } },
    })
    return ok(res, {
      list: list.map((o) => ({
        ...o,
        branchName: o.branch?.name ?? null,
      })),
    })
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

officesRouter.get(
  '/:id/statement',
  asyncHandler(async (req, res) => {
    const office = await prisma.office.findUnique({ where: { id: paramId(req) } })
    if (!office) return fail(res, 'المكتب غير موجود', 404)
    if (req.user!.role !== 'admin' && req.user!.officeId !== office.id) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }

    const ledgerAccountId = office.ledgerAccountId
    if (!ledgerAccountId) {
      return fail(
        res,
        `المكتب غير مربوط بحساب ذمة — اربطه من إدارة المكاتب بحساب فرعي لـ «${office.name}»`,
      )
    }

    const fromDate = typeof req.query.from === 'string' && req.query.from ? req.query.from : null
    const toDate = typeof req.query.to === 'string' && req.query.to ? req.query.to : null
    const typesRaw = typeof req.query.types === 'string' ? req.query.types : ''
    const types = typesRaw
      ? typesRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : null

    const result = await getOfficeLedgerStatement({
      ledgerAccountId,
      fromDate,
      toDate,
      types,
    })
    return ok(res, {
      officeId: office.id,
      officeName: office.name,
      ledgerAccountId,
      fromDate,
      toDate,
      ...result,
    })
  }),
)

officesRouter.post(
  '/',
  requireRoles('admin', 'branch_admin'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        city: z.string().min(1),
        phone: z.string().min(1),
        status: z.enum(['active', 'suspended']).optional(),
        subscription: z.enum(['active', 'expired', 'trial']).optional(),
        ledgerAccountId: z.number().nullable().optional(),
        commissionPercent: z.number().min(0).max(100).optional(),
        branchId: z.string().nullable().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    let branchId = body.data.branchId ?? null
    if (req.user!.role === 'branch_admin') {
      if (!req.user!.branchId) return fail(res, 'الفرع غير محدد', 403)
      branchId = req.user!.branchId
    } else if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } })
      if (!branch) return fail(res, 'الفرع غير موجود', 404)
    }

    let commissionPercent = body.data.commissionPercent ?? 0
    if (req.user!.role === 'branch_admin' && branchId && body.data.commissionPercent === undefined) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } })
      commissionPercent = branch?.commissionPercent ?? 0
    }

    const office = await prisma.office.create({
      data: {
        name: body.data.name,
        city: body.data.city,
        phone: body.data.phone,
        status: body.data.status ?? 'active',
        subscription: body.data.subscription ?? 'trial',
        branchId,
        ledgerAccountId: body.data.ledgerAccountId ?? null,
        commissionPercent,
      },
    })
    return ok(res, { office }, 201)
  }),
)

officesRouter.put(
  '/:id',
  requireRoles('admin', 'branch_admin'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.office.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'المكتب غير موجود', 404)
    if (req.user!.role === 'branch_admin') {
      if (existing.branchId !== req.user!.branchId) {
        return fail(res, 'ليس لديك صلاحية', 403)
      }
    }

    const body = z
      .object({
        name: z.string().min(1).optional(),
        city: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
        status: z.enum(['active', 'suspended']).optional(),
        subscription: z.enum(['active', 'expired', 'trial']).optional(),
        ledgerAccountId: z.number().nullable().optional(),
        commissionPercent: z.number().min(0).max(100).optional(),
        branchId: z.string().nullable().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const data = { ...body.data }
    if (req.user!.role === 'branch_admin') {
      delete data.branchId
    } else if (data.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: data.branchId as string } })
      if (!branch) return fail(res, 'الفرع غير موجود', 404)
    }

    const office = await prisma.office.update({
      where: { id: paramId(req) },
      data,
    })
    return ok(res, { office })
  }),
)
