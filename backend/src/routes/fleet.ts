import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin, requireAgencyAdmin } from '../middleware/auth'
import {
  branchIdOnCreate,
  branchOwnedWhere,
  catalogListWhere,
  fleetListWhere,
} from '../utils/branchScope'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

function assertBranchEntity(
  req: { user?: { role: string; branchId: string | null } },
  branchId: string | null,
) {
  if (req.user!.role === 'branch_admin' && branchId !== req.user!.branchId) {
    return false
  }
  return true
}

export const destinationsRouter = Router()
destinationsRouter.use(authRequired)

destinationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await prisma.destination.findMany({
      where: await catalogListWhere(req.user!),
      orderBy: { name: 'asc' },
    })
    return ok(res, { list })
  }),
)

destinationsRouter.post(
  '/',
  requireAgencyAdmin,
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
        branchId: branchIdOnCreate(req.user!),
      },
    })
    return ok(res, { destination }, 201)
  }),
)

destinationsRouter.put(
  '/:id',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.destination.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'غير موجود', 404)
    if (!assertBranchEntity(req, existing.branchId)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
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
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.destination.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'غير موجود', 404)
    if (!assertBranchEntity(req, existing.branchId)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
    await prisma.destination.delete({ where: { id: paramId(req) } })
    return ok(res, { deleted: true })
  }),
)

export const visaTypesRouter = Router()
visaTypesRouter.use(authRequired)

visaTypesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await prisma.visaType.findMany({
      where: await catalogListWhere(req.user!),
      orderBy: { name: 'asc' },
    })
    return ok(res, { list })
  }),
)

visaTypesRouter.post(
  '/',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const body = z.object({ name: z.string().min(1) }).safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const visaType = await prisma.visaType.create({
      data: { name: body.data.name.trim(), branchId: branchIdOnCreate(req.user!) },
    })
    return ok(res, { visaType }, 201)
  }),
)

visaTypesRouter.put(
  '/:id',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.visaType.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'غير موجود', 404)
    if (!assertBranchEntity(req, existing.branchId)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
    const body = z.object({ name: z.string().min(1) }).safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const visaType = await prisma.visaType.update({
      where: { id: paramId(req) },
      data: { name: body.data.name.trim() },
    })
    return ok(res, { visaType })
  }),
)

visaTypesRouter.delete(
  '/:id',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.visaType.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'غير موجود', 404)
    if (!assertBranchEntity(req, existing.branchId)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
    await prisma.visaType.delete({ where: { id: paramId(req) } })
    return ok(res, { deleted: true })
  }),
)

const busPayload = z.object({
  busNumber: z.string().optional(),
  plateNumber: z.string().min(1),
  type: z.string().optional(),
  year: z.string().optional(),
  seats: z.number().int().positive(),
  status: z.enum(['available', 'maintenance', 'inactive']).optional(),
  chassisNumber: z.string().optional(),
  operatingNumber: z.string().optional(),
  busTypeId: z.string().optional().nullable(),
  busModelId: z.string().optional().nullable(),
  insuranceCompanyId: z.string().optional().nullable(),
  insuranceExpiry: z.string().optional(),
  registrationExpiry: z.string().optional(),
  operatingCardExpiry: z.string().optional(),
  initialOdometer: z.string().optional(),
  notes: z.string().optional(),
})

async function resolveBusTypeYear(input: {
  type?: string
  year?: string
  busTypeId?: string | null
  busModelId?: string | null
}) {
  let type = (input.type ?? '').trim()
  let year = (input.year ?? '').trim()
  if (input.busTypeId) {
    const row = await prisma.busType.findUnique({ where: { id: input.busTypeId } })
    if (row) type = row.name
  }
  if (input.busModelId) {
    const row = await prisma.busModelCatalog.findUnique({ where: { id: input.busModelId } })
    if (row) year = row.name
  }
  if (!type) type = 'عادي'
  return { type, year }
}

function catalogCrud(model: 'busType' | 'busModelCatalog' | 'insuranceCompany') {
  const router = Router()
  router.use(authRequired)
  const prismaModel =
    model === 'busType'
      ? prisma.busType
      : model === 'busModelCatalog'
        ? prisma.busModelCatalog
        : prisma.insuranceCompany

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const list = await (prismaModel as any).findMany({
        where: branchOwnedWhere(req.user!),
        orderBy: { name: 'asc' },
      })
      return ok(res, { list })
    }),
  )

  router.post(
    '/',
    requireAgencyAdmin,
    asyncHandler(async (req, res) => {
      const body = z
        .object({
          name: z.string().min(1),
          phone: z.string().optional(),
        })
        .safeParse(req.body)
      if (!body.success) return fail(res, 'بيانات غير صالحة')
      const row = await (prismaModel as any).create({
        data: {
          name: body.data.name.trim(),
          ...(model === 'insuranceCompany' ? { phone: (body.data.phone ?? '').trim() } : {}),
          branchId: branchIdOnCreate(req.user!),
        },
      })
      return ok(res, { item: row }, 201)
    }),
  )

  router.put(
    '/:id',
    requireAgencyAdmin,
    asyncHandler(async (req, res) => {
      const existing = await (prismaModel as any).findUnique({ where: { id: paramId(req) } })
      if (!existing) return fail(res, 'غير موجود', 404)
      if (!assertBranchEntity(req, existing.branchId)) {
        return fail(res, 'ليس لديك صلاحية', 403)
      }
      const body = z
        .object({
          name: z.string().min(1),
          phone: z.string().optional(),
        })
        .safeParse(req.body)
      if (!body.success) return fail(res, 'بيانات غير صالحة')
      const row = await (prismaModel as any).update({
        where: { id: paramId(req) },
        data: {
          name: body.data.name.trim(),
          ...(model === 'insuranceCompany' && body.data.phone !== undefined
            ? { phone: body.data.phone.trim() }
            : {}),
        },
      })
      return ok(res, { item: row })
    }),
  )

  router.delete(
    '/:id',
    requireAgencyAdmin,
    asyncHandler(async (req, res) => {
      const existing = await (prismaModel as any).findUnique({ where: { id: paramId(req) } })
      if (!existing) return fail(res, 'غير موجود', 404)
      if (!assertBranchEntity(req, existing.branchId)) {
        return fail(res, 'ليس لديك صلاحية', 403)
      }
      const used =
        model === 'busType'
          ? await prisma.bus.count({ where: { busTypeId: existing.id } })
          : model === 'busModelCatalog'
            ? await prisma.bus.count({ where: { busModelId: existing.id } })
            : await prisma.bus.count({ where: { insuranceCompanyId: existing.id } })
      if (used > 0) return fail(res, 'لا يمكن الحذف — مرتبط بحافلات', 400)
      await (prismaModel as any).delete({ where: { id: paramId(req) } })
      return ok(res, { deleted: true })
    }),
  )

  return router
}

export const busTypesRouter = catalogCrud('busType')
export const busModelsRouter = catalogCrud('busModelCatalog')
export const insuranceCompaniesRouter = catalogCrud('insuranceCompany')

export const busesRouter = Router()
busesRouter.use(authRequired)

const busInclude = {
  busType: { select: { id: true, name: true } },
  busModel: { select: { id: true, name: true } },
  insuranceCompany: { select: { id: true, name: true } },
}

busesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await prisma.bus.findMany({
      where: fleetListWhere(req.user!),
      include: busInclude,
      orderBy: [{ busNumber: 'asc' }, { plateNumber: 'asc' }],
    })
    return ok(res, { list })
  }),
)

busesRouter.post(
  '/',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const body = busPayload.safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const { type, year } = await resolveBusTypeYear(body.data)
    const bus = await prisma.bus.create({
      data: {
        busNumber: body.data.busNumber?.trim() ?? '',
        plateNumber: body.data.plateNumber.trim(),
        type,
        year,
        seats: body.data.seats,
        status: body.data.status ?? 'available',
        chassisNumber: (body.data.chassisNumber ?? '').trim(),
        operatingNumber: (body.data.operatingNumber ?? '').trim(),
        busTypeId: body.data.busTypeId ?? null,
        busModelId: body.data.busModelId ?? null,
        insuranceCompanyId: body.data.insuranceCompanyId ?? null,
        insuranceExpiry: (body.data.insuranceExpiry ?? '').trim(),
        registrationExpiry: (body.data.registrationExpiry ?? '').trim(),
        operatingCardExpiry: (body.data.operatingCardExpiry ?? '').trim(),
        initialOdometer: (body.data.initialOdometer ?? '').trim(),
        notes: (body.data.notes ?? '').trim(),
        branchId: branchIdOnCreate(req.user!),
      },
      include: busInclude,
    })
    return ok(res, { bus }, 201)
  }),
)

busesRouter.put(
  '/:id',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.bus.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'غير موجود', 404)
    if (!assertBranchEntity(req, existing.branchId)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
    const body = busPayload.partial().extend({ plateNumber: z.string().min(1).optional() }).safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
  const merged = {
      type: body.data.type ?? existing.type,
      year: body.data.year ?? existing.year,
      busTypeId:
        body.data.busTypeId !== undefined ? body.data.busTypeId : existing.busTypeId,
      busModelId:
        body.data.busModelId !== undefined ? body.data.busModelId : existing.busModelId,
    }
    const { type, year } = await resolveBusTypeYear(merged)
    const bus = await prisma.bus.update({
      where: { id: paramId(req) },
      data: {
        ...(body.data.plateNumber !== undefined ? { plateNumber: body.data.plateNumber.trim() } : {}),
        ...(body.data.busNumber !== undefined ? { busNumber: body.data.busNumber.trim() } : {}),
        ...(body.data.seats !== undefined ? { seats: body.data.seats } : {}),
        ...(body.data.status !== undefined ? { status: body.data.status } : {}),
        type,
        year,
        ...(body.data.chassisNumber !== undefined
          ? { chassisNumber: body.data.chassisNumber.trim() }
          : {}),
        ...(body.data.operatingNumber !== undefined
          ? { operatingNumber: body.data.operatingNumber.trim() }
          : {}),
        ...(body.data.busTypeId !== undefined ? { busTypeId: body.data.busTypeId } : {}),
        ...(body.data.busModelId !== undefined ? { busModelId: body.data.busModelId } : {}),
        ...(body.data.insuranceCompanyId !== undefined
          ? { insuranceCompanyId: body.data.insuranceCompanyId }
          : {}),
        ...(body.data.insuranceExpiry !== undefined
          ? { insuranceExpiry: body.data.insuranceExpiry.trim() }
          : {}),
        ...(body.data.registrationExpiry !== undefined
          ? { registrationExpiry: body.data.registrationExpiry.trim() }
          : {}),
        ...(body.data.operatingCardExpiry !== undefined
          ? { operatingCardExpiry: body.data.operatingCardExpiry.trim() }
          : {}),
        ...(body.data.initialOdometer !== undefined
          ? { initialOdometer: body.data.initialOdometer.trim() }
          : {}),
        ...(body.data.notes !== undefined ? { notes: body.data.notes.trim() } : {}),
      },
      include: busInclude,
    })
    return ok(res, { bus })
  }),
)

export const driversRouter = Router()
driversRouter.use(authRequired)

driversRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await prisma.driver.findMany({
      where: fleetListWhere(req.user!),
      orderBy: { name: 'asc' },
    })
    return ok(res, { list })
  }),
)

driversRouter.post(
  '/',
  requireAgencyAdmin,
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
        branchId: branchIdOnCreate(req.user!),
      },
    })
    return ok(res, { driver }, 201)
  }),
)

driversRouter.put(
  '/:id',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.driver.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'غير موجود', 404)
    if (!assertBranchEntity(req, existing.branchId)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
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

