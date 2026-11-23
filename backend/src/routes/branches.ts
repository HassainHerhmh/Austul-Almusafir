import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin } from '../middleware/auth'
import { getOfficeLedgerStatement } from '../services/ledger'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

export const branchesRouter = Router()
branchesRouter.use(authRequired)

branchesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user!.role !== 'admin') {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
    const list = await prisma.branch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { offices: true } } },
    })
    return ok(res, {
      list: list.map((b) => ({
        id: b.id,
        name: b.name,
        city: b.city,
        phone: b.phone,
        status: b.status,
        ledgerAccountId: b.ledgerAccountId,
        commissionPercent: b.commissionPercent,
        createdAt: b.createdAt,
        officeCount: b._count.offices,
      })),
    })
  }),
)

branchesRouter.get(
  '/current',
  asyncHandler(async (req, res) => {
    const branchId =
      req.user!.role === 'branch_admin'
        ? req.user!.branchId
        : req.user!.role === 'admin' && typeof req.query.id === 'string'
          ? req.query.id
          : null
    if (!branchId) return fail(res, 'ليس لديك فرع مرتبط', 404)
    const branch = await prisma.branch.findUnique({ where: { id: branchId } })
    if (!branch) return fail(res, 'الفرع غير موجود', 404)
    if (req.user!.role === 'branch_admin' && req.user!.branchId !== branch.id) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
  return ok(res, { branch })
  }),
)

branchesRouter.get(
  '/:id/statement',
  asyncHandler(async (req, res) => {
    const branch = await prisma.branch.findUnique({ where: { id: paramId(req) } })
    if (!branch) return fail(res, 'الفرع غير موجود', 404)
    if (req.user!.role === 'branch_admin') {
      if (req.user!.branchId !== branch.id) return fail(res, 'ليس لديك صلاحية', 403)
    } else if (req.user!.role !== 'admin') {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
    const ledgerAccountId = branch.ledgerAccountId
    if (!ledgerAccountId) {
      return fail(res, 'الفرع غير مربوط بحساب ذمة', 400)
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
      branchId: branch.id,
      branchName: branch.name,
      ledgerAccountId,
      fromDate,
      toDate,
      ...result,
    })
  }),
)

branchesRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        city: z.string().optional(),
        phone: z.string().optional(),
        status: z.enum(['active', 'suspended']).optional(),
        ledgerAccountId: z.number().nullable().optional(),
        commissionPercent: z.number().min(0).max(100).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const branch = await prisma.branch.create({
      data: {
        name: body.data.name,
        city: body.data.city ?? '',
        phone: body.data.phone ?? '',
        status: body.data.status ?? 'active',
        ledgerAccountId: body.data.ledgerAccountId ?? null,
        commissionPercent: body.data.commissionPercent ?? 0,
      },
    })
    return ok(res, { branch }, 201)
  }),
)

branchesRouter.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.branch.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'الفرع غير موجود', 404)

    const body = z
      .object({
        name: z.string().min(1).optional(),
        city: z.string().optional(),
        phone: z.string().optional(),
        status: z.enum(['active', 'suspended']).optional(),
        ledgerAccountId: z.number().nullable().optional(),
        commissionPercent: z.number().min(0).max(100).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const branch = await prisma.branch.update({
      where: { id: paramId(req) },
      data: body.data,
    })
    return ok(res, { branch })
  }),
)