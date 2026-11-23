import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin } from '../middleware/auth'
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