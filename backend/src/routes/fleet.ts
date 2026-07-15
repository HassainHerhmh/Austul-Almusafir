import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin } from '../middleware/auth'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

export const destinationsRouter = Router()
destinationsRouter.use(authRequired)

destinationsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const list = await prisma.destination.findMany({ orderBy: { name: 'asc' } })
    return ok(res, { list })
  }),
)

destinationsRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        ticketPrice: z.number().min(0).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const destination = await prisma.destination.create({
      data: {
        name: body.data.name,
        ticketPrice: body.data.ticketPrice ?? 0,
      },
    })
    return ok(res, { destination }, 201)
  }),
)

destinationsRouter.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        ticketPrice: z.number().min(0).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const destination = await prisma.destination.update({
      where: { id: paramId(req) },
      data: {
        name: body.data.name,
        ...(body.data.ticketPrice !== undefined ? { ticketPrice: body.data.ticketPrice } : {}),
      },
    })
    return ok(res, { destination })
  }),
)

destinationsRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await prisma.destination.delete({ where: { id: paramId(req) } })
    return ok(res, { deleted: true })
  }),
)

export const busesRouter = Router()
busesRouter.use(authRequired)

busesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const list = await prisma.bus.findMany({ orderBy: [{ busNumber: 'asc' }, { plateNumber: 'asc' }] })
    return ok(res, { list })
  }),
)

busesRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        busNumber: z.string().optional(),
        plateNumber: z.string().min(1),
        type: z.string().min(1),
        year: z.string().optional(),
        seats: z.number().int().positive(),
        status: z.enum(['available', 'maintenance', 'inactive']).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const bus = await prisma.bus.create({
      data: {
        busNumber: body.data.busNumber?.trim() ?? '',
        plateNumber: body.data.plateNumber,
        type: body.data.type,
        year: body.data.year?.trim() ?? '',
        seats: body.data.seats,
        status: body.data.status ?? 'available',
      },
    })
    return ok(res, { bus }, 201)
  }),
)

busesRouter.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        busNumber: z.string().optional(),
        plateNumber: z.string().min(1).optional(),
        type: z.string().min(1).optional(),
        year: z.string().optional(),
        seats: z.number().int().positive().optional(),
        status: z.enum(['available', 'maintenance', 'inactive']).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const bus = await prisma.bus.update({
      where: { id: paramId(req) },
      data: {
        ...body.data,
        ...(body.data.busNumber !== undefined ? { busNumber: body.data.busNumber.trim() } : {}),
        ...(body.data.year !== undefined ? { year: body.data.year.trim() } : {}),
      },
    })
    return ok(res, { bus })
  }),
)

export const driversRouter = Router()
driversRouter.use(authRequired)

driversRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const list = await prisma.driver.findMany({ orderBy: { name: 'asc' } })
    return ok(res, { list })
  }),
)

driversRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        phone: z.string().min(1),
        licenseNumber: z.string().min(1),
        nationality: z.string().default(''),
        role: z.enum(['primary', 'assistant']).optional(),
        active: z.boolean().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const driver = await prisma.driver.create({
      data: {
        name: body.data.name,
        phone: body.data.phone,
        licenseNumber: body.data.licenseNumber,
        nationality: body.data.nationality,
        role: body.data.role ?? 'primary',
        active: body.data.active ?? true,
      },
    })
    return ok(res, { driver }, 201)
  }),
)

driversRouter.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
        licenseNumber: z.string().min(1).optional(),
        nationality: z.string().optional(),
        role: z.enum(['primary', 'assistant']).optional(),
        active: z.boolean().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const driver = await prisma.driver.update({ where: { id: paramId(req) }, data: body.data })
    return ok(res, { driver })
  }),
)

driversRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = paramId(req)
    const linked = await prisma.trip.count({ where: { driverId: id } })
    if (linked > 0) {
      return fail(res, 'لا يمكن حذف السائق لارتباطه برحلات — أوقف السائق بدلاً من الحذف')
    }
    await prisma.driver.delete({ where: { id } })
    return ok(res, { deleted: true })
  }),
)

