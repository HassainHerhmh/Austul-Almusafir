import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireRoles } from '../middleware/auth'
import { asyncHandler, fail, ok } from '../utils/http'

export const customersRouter = Router()
customersRouter.use(authRequired)

customersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const officeId =
      req.user!.role === 'admin'
        ? (req.query.officeId as string | undefined)
        : req.user!.officeId ?? undefined
    const list = await prisma.customer.findMany({
      where: officeId ? { officeId } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return ok(res, { list })
  }),
)

customersRouter.post(
  '/',
  requireRoles('admin', 'office_manager', 'booking_clerk'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        phone: z.string().min(1),
        nationalId: z.string().min(1),
        passportNumber: z.string().optional(),
        officeId: z.string().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const officeId =
      req.user!.role === 'admin' ? body.data.officeId : req.user!.officeId
    if (!officeId) return fail(res, 'المكتب مطلوب')

    const customer = await prisma.customer.create({
      data: {
        name: body.data.name,
        phone: body.data.phone,
        nationalId: body.data.nationalId,
        passportNumber: body.data.passportNumber ?? '',
        officeId,
      },
    })
    return ok(res, { customer }, 201)
  }),
)

export const vouchersRouter = Router()
vouchersRouter.use(authRequired)

vouchersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const officeId =
      req.user!.role === 'admin'
        ? (req.query.officeId as string | undefined)
        : req.user!.officeId ?? undefined
    const list = await prisma.voucher.findMany({
      where: officeId ? { officeId } : undefined,
      orderBy: { date: 'desc' },
    })
    return ok(res, { list })
  }),
)

vouchersRouter.post(
  '/',
  requireRoles('admin', 'office_manager', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        officeId: z.string().optional(),
        type: z.enum(['receipt', 'payment']),
        amount: z.number().positive(),
        description: z.string().min(1),
        date: z.string().min(1),
        relatedBookingId: z.string().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const officeId =
      req.user!.role === 'admin' ? body.data.officeId : req.user!.officeId
    if (!officeId) return fail(res, 'المكتب مطلوب')

    const voucher = await prisma.voucher.create({
      data: {
        officeId,
        type: body.data.type,
        amount: body.data.amount,
        description: body.data.description,
        date: body.data.date,
        relatedBookingId: body.data.relatedBookingId,
      },
    })
    return ok(res, { voucher }, 201)
  }),
)
