import { randomBytes } from 'crypto'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin, requireRoles } from '../middleware/auth'
import { asyncHandler, fail, ok } from '../utils/http'

export const trackingRouter = Router()

const STALE_MS = 2 * 60 * 1000

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

function makeShareToken() {
  return randomBytes(24).toString('hex')
}

function mapShareRow(share: {
  id: string
  token: string
  tripId: string
  active: boolean
  label: string
  createdAt: Date
  updatedAt: Date
  trip: {
    date: string
    departureTime: string
    status: string
    bus: { busNumber: string; plateNumber: string }
    stops: { destination: { name: string }; sortOrder: number }[]
  }
}) {
  const routeLabel = tripLabel(share.trip.stops) || share.label || share.tripId
  return {
    id: share.id,
    token: share.token,
    tripId: share.tripId,
    active: share.active,
    label: share.label,
    urlPath: `/track/${share.token}`,
    createdAt: share.createdAt.toISOString(),
    updatedAt: share.updatedAt.toISOString(),
    trip: {
      id: share.tripId,
      date: share.trip.date,
      departureTime: share.trip.departureTime,
      status: share.trip.status,
      label: routeLabel,
      busNumber: share.trip.bus.busNumber,
      plateNumber: share.trip.bus.plateNumber,
    },
  }
}

const shareInclude = {
  trip: {
    include: {
      bus: true,
      stops: { include: { destination: true }, orderBy: { sortOrder: 'asc' as const } },
    },
  },
}

/** عام — صفحة التتبع المشتركة بدون تسجيل دخول */
trackingRouter.get(
  '/public/:token',
  asyncHandler(async (req, res) => {
    const token = String(req.params.token || '').trim()
    if (!token || token.length < 16) return fail(res, 'رابط التتبع غير صالح', 404)

    const share = await prisma.tripTrackingShare.findUnique({
      where: { token },
      include: {
        trip: {
          include: {
            bus: true,
            location: true,
            stops: { include: { destination: true }, orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    })

    if (!share) return fail(res, 'رابط التتبع غير موجود أو تم حذفه', 404)

    const label = tripLabel(share.trip.stops) || share.label || 'رحلة'
    const base = {
      token: share.token,
      tripId: share.tripId,
      label,
      busNumber: share.trip.bus.busNumber,
      plateNumber: share.trip.bus.plateNumber,
      date: share.trip.date,
      departureTime: share.trip.departureTime,
    }

    if (!share.active) {
      return ok(res, {
        status: 'stopped' as const,
        message: 'تم إيقاف رابط التتبع — لم يعد عرض الموقع متاحاً',
        ...base,
        lat: null,
        lng: null,
        updatedAt: null,
        trackingActive: false,
      })
    }

    const loc = share.trip.location
    if (!loc) {
      return ok(res, {
        status: 'no_signal' as const,
        message: 'لم يبدأ إرسال الموقع بعد',
        ...base,
        lat: null,
        lng: null,
        updatedAt: null,
        trackingActive: false,
      })
    }

    const stale = Date.now() - loc.updatedAt.getTime() > STALE_MS
    const status =
      !loc.active ? ('stopped' as const) : stale ? ('no_signal' as const) : ('live' as const)

    return ok(res, {
      status,
      message:
        status === 'live'
          ? null
          : status === 'no_signal'
            ? 'انقطع إرسال الموقع مؤقتاً'
            : 'توقف إرسال الموقع من السائق',
      ...base,
      lat: loc.lat,
      lng: loc.lng,
      updatedAt: loc.updatedAt.toISOString(),
      trackingActive: loc.active,
      accuracy: loc.accuracy,
      speed: loc.speed,
      heading: loc.heading,
    })
  }),
)

trackingRouter.use(authRequired)

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
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const list = await prisma.tripLocation.findMany({
      where: { updatedAt: { gte: since } },
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

trackingRouter.get(
  '/shareable-trips',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const today = new Date().toISOString().slice(0, 10)
    const trips = await prisma.trip.findMany({
      where: {
        status: { in: ['open', 'departed', 'scheduled'] },
        OR: [{ date: today }, { status: { in: ['open', 'departed'] } }],
      },
      include: {
        bus: true,
        stops: { include: { destination: true }, orderBy: { sortOrder: 'asc' } },
        location: true,
      },
      orderBy: [{ date: 'desc' }, { departureTime: 'desc' }],
      take: 80,
    })

    return ok(res, {
      list: trips.map((t) => ({
        id: t.id,
        date: t.date,
        departureTime: t.departureTime,
        status: t.status,
        busNumber: t.bus.busNumber,
        plateNumber: t.bus.plateNumber,
        label: tripLabel(t.stops) || t.id,
        trackingActive: t.location?.active ?? false,
        lastUpdatedAt: t.location?.updatedAt?.toISOString() ?? null,
      })),
    })
  }),
)

trackingRouter.get(
  '/shares',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const list = await prisma.tripTrackingShare.findMany({
      include: shareInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return ok(res, { list: list.map(mapShareRow) })
  }),
)

trackingRouter.post(
  '/shares',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        tripId: z.string().min(1),
        label: z.string().max(120).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const trip = await prisma.trip.findUnique({
      where: { id: body.data.tripId },
      include: {
        bus: true,
        stops: { include: { destination: true }, orderBy: { sortOrder: 'asc' } },
      },
    })
    if (!trip) return fail(res, 'الرحلة غير موجودة', 404)
    if (['cancelled', 'completed'].includes(trip.status)) {
      return fail(res, 'لا يمكن إنشاء رابط لرحلة منتهية أو ملغاة', 400)
    }

    const routeLabel = tripLabel(trip.stops) || trip.id
    const share = await prisma.tripTrackingShare.create({
      data: {
        token: makeShareToken(),
        tripId: trip.id,
        active: true,
        label: body.data.label?.trim() || routeLabel,
      },
      include: shareInclude,
    })

    return ok(res, { share: mapShareRow(share) })
  }),
)

trackingRouter.post(
  '/shares/:id/stop',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id || '')
    const existing = await prisma.tripTrackingShare.findUnique({ where: { id } })
    if (!existing) return fail(res, 'الرابط غير موجود', 404)

    const share = await prisma.tripTrackingShare.update({
      where: { id },
      data: { active: false },
      include: shareInclude,
    })
    return ok(res, { share: mapShareRow(share) })
  }),
)

trackingRouter.post(
  '/shares/:id/resume',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id || '')
    const existing = await prisma.tripTrackingShare.findUnique({ where: { id } })
    if (!existing) return fail(res, 'الرابط غير موجود', 404)

    const share = await prisma.tripTrackingShare.update({
      where: { id },
      data: { active: true },
      include: shareInclude,
    })
    return ok(res, { share: mapShareRow(share) })
  }),
)

trackingRouter.delete(
  '/shares/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id || '')
    const existing = await prisma.tripTrackingShare.findUnique({ where: { id } })
    if (!existing) return fail(res, 'الرابط غير موجود', 404)

    await prisma.tripTrackingShare.delete({ where: { id } })
    return ok(res, { deleted: true })
  }),
)
