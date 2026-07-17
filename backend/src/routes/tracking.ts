import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireRoles } from '../middleware/auth'
import { asyncHandler, fail, ok } from '../utils/http'

export const trackingRouter = Router()
trackingRouter.use(authRequired)

async function resolveDriverId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { driverId: true, role: true },
  })
  if (!user || user.role !== 'driver' || !user.driverId) return null
  return user.driverId
}

function tripLabel(stops: { destination: { name: string }; sortOrder: number }[]) {
  return [...stops]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => s.destination.name)
    .join(' ← ')
}

trackingRouter.get(
  '/my-trips',
  requireRoles('driver'),
  asyncHandler(async (req, res) => {
    const driverId = await resolveDriverId(req.user!.id)
    if (!driverId) return fail(res, 'الحساب غير مربوط بسائق — راجع الإدارة', 400)

    const today = new Date().toISOString().slice(0, 10)
    const trips = await prisma.trip.findMany({
      where: {
        driverId,
        status: { in: ['open', 'departed', 'scheduled'] },
        OR: [{ date: today }, { status: { in: ['open', 'departed'] } }],
      },
      include: {
        bus: true,
        stops: { include: { destination: true }, orderBy: { sortOrder: 'asc' } },
        location: true,
      },
      orderBy: [{ date: 'desc' }, { departureTime: 'desc' }],
    })

    return ok(res, {
      list: trips.map((t) => ({
        id: t.id,
        date: t.date,
        departureTime: t.departureTime,
        status: t.status,
        price: t.price,
        busNumber: t.bus.busNumber,
        plateNumber: t.bus.plateNumber,
        label: tripLabel(t.stops) || t.id,
        trackingActive: t.location?.active ?? false,
        lastLat: t.location?.lat ?? null,
        lastLng: t.location?.lng ?? null,
        lastUpdatedAt: t.location?.updatedAt?.toISOString() ?? null,
      })),
    })
  }),
)

trackingRouter.post(
  '/ping',
  requireRoles('driver'),
  asyncHandler(async (req, res) => {
    const driverId = await resolveDriverId(req.user!.id)
    if (!driverId) return fail(res, 'الحساب غير مربوط بسائق — راجع الإدارة', 400)

    const body = z
      .object({
        tripId: z.string().min(1),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        accuracy: z.number().nullable().optional(),
        speed: z.number().nullable().optional(),
        heading: z.number().nullable().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات الموقع غير صالحة')

    const trip = await prisma.trip.findUnique({ where: { id: body.data.tripId } })
    if (!trip) return fail(res, 'الرحلة غير موجودة', 404)
    if (trip.driverId !== driverId) return fail(res, 'هذه الرحلة ليست مرتبطة بحسابك', 403)
    if (['cancelled', 'completed'].includes(trip.status)) {
      return fail(res, 'لا يمكن تتبع رحلة منتهية أو ملغاة', 400)
    }

    const location = await prisma.tripLocation.upsert({
      where: { tripId: trip.id },
      create: {
        tripId: trip.id,
        lat: body.data.lat,
        lng: body.data.lng,
        accuracy: body.data.accuracy ?? null,
        speed: body.data.speed ?? null,
        heading: body.data.heading ?? null,
        active: true,
      },
      update: {
        lat: body.data.lat,
        lng: body.data.lng,
        accuracy: body.data.accuracy ?? null,
        speed: body.data.speed ?? null,
        heading: body.data.heading ?? null,
        active: true,
      },
    })

    return ok(res, {
      location: {
        tripId: location.tripId,
        lat: location.lat,
        lng: location.lng,
        active: location.active,
        updatedAt: location.updatedAt.toISOString(),
      },
    })
  }),
)

trackingRouter.post(
  '/stop',
  requireRoles('driver'),
  asyncHandler(async (req, res) => {
    const driverId = await resolveDriverId(req.user!.id)
    if (!driverId) return fail(res, 'الحساب غير مربوط بسائق — راجع الإدارة', 400)

    const body = z.object({ tripId: z.string().min(1) }).safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const trip = await prisma.trip.findUnique({ where: { id: body.data.tripId } })
    if (!trip) return fail(res, 'الرحلة غير موجودة', 404)
    if (trip.driverId !== driverId) return fail(res, 'هذه الرحلة ليست مرتبطة بحسابك', 403)

    const existing = await prisma.tripLocation.findUnique({ where: { tripId: trip.id } })
    if (!existing) return ok(res, { stopped: true })

    const location = await prisma.tripLocation.update({
      where: { tripId: trip.id },
      data: { active: false },
    })

    return ok(res, {
      location: {
        tripId: location.tripId,
        active: location.active,
        updatedAt: location.updatedAt.toISOString(),
      },
    })
  }),
)

trackingRouter.get(
  '/live',
  requireRoles('admin'),
  asyncHandler(async (_req, res) => {
    const list = await prisma.tripLocation.findMany({
      where: { active: true },
      include: {
        trip: {
          include: {
            bus: true,
            driver: true,
            stops: { include: { destination: true }, orderBy: { sortOrder: 'asc' } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return ok(res, {
      list: list.map((loc) => ({
        tripId: loc.tripId,
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy,
        speed: loc.speed,
        heading: loc.heading,
        active: loc.active,
        updatedAt: loc.updatedAt.toISOString(),
        trip: {
          id: loc.trip.id,
          date: loc.trip.date,
          departureTime: loc.trip.departureTime,
          status: loc.trip.status,
          label: tripLabel(loc.trip.stops),
          busNumber: loc.trip.bus.busNumber,
          plateNumber: loc.trip.bus.plateNumber,
          driverName: loc.trip.driver.name,
          driverPhone: loc.trip.driver.phone,
        },
      })),
    })
  }),
)
