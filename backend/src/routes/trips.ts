import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin } from '../middleware/auth'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

export const tripsRouter = Router()
tripsRouter.use(authRequired)

function mapTrip(t: {
  id: string
  busId: string
  driverId: string
  assistantName: string
  assistantPhone: string
  date: string
  departureTime: string
  price: number
  status: string
  stops: { destinationId: string; point: string; sortOrder: number }[]
}) {
  return {
    id: t.id,
    busId: t.busId,
    driverId: t.driverId,
    assistantName: t.assistantName ?? '',
    assistantPhone: t.assistantPhone ?? '',
    date: t.date,
    departureTime: t.departureTime,
    price: t.price,
    status: t.status,
    stops: [...t.stops]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({ destinationId: s.destinationId, point: s.point })),
  }
}

tripsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const list = await prisma.trip.findMany({
      include: { stops: true },
      orderBy: [{ date: 'asc' }, { departureTime: 'asc' }],
    })
    return ok(res, { list: list.map(mapTrip) })
  }),
)

tripsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const trip = await prisma.trip.findUnique({
      where: { id: paramId(req) },
      include: { stops: true },
    })
    if (!trip) return fail(res, 'الرحلة غير موجودة', 404)
    return ok(res, { trip: mapTrip(trip) })
  }),
)

tripsRouter.get(
  '/:id/seats',
  asyncHandler(async (req, res) => {
    const trip = await prisma.trip.findUnique({
      where: { id: paramId(req) },
      include: { bus: true },
    })
    if (!trip) return fail(res, 'الرحلة غير موجودة', 404)
    const confirmed = await prisma.booking.findMany({
      where: { tripId: trip.id, status: 'confirmed' },
      select: { seatNumber: true },
    })
    const bookedSeats = confirmed.map((b) => b.seatNumber)
    return ok(res, {
      total: trip.bus.seats,
      booked: bookedSeats.length,
      remaining: Math.max(0, trip.bus.seats - bookedSeats.length),
      bookedSeats,
    })
  }),
)

const stopSchema = z.object({
  destinationId: z.string().min(1),
  point: z.string().min(1),
})

tripsRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        busId: z.string(),
        driverId: z.string(),
        assistantName: z.string().optional(),
        assistantPhone: z.string().optional(),
        date: z.string().min(1),
        departureTime: z.string().min(1),
        price: z.number().positive(),
        status: z.enum(['scheduled', 'departed', 'cancelled', 'completed']).optional(),
        stops: z.array(stopSchema).min(2),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات الرحلة غير صالحة')

    const trip = await prisma.trip.create({
      data: {
        busId: body.data.busId,
        driverId: body.data.driverId,
        assistantName: body.data.assistantName?.trim() ?? '',
        assistantPhone: body.data.assistantPhone?.trim() ?? '',
        date: body.data.date,
        departureTime: body.data.departureTime,
        price: body.data.price,
        status: body.data.status ?? 'scheduled',
        stops: {
          create: body.data.stops.map((s, i) => ({
            destinationId: s.destinationId,
            point: s.point,
            sortOrder: i,
          })),
        },
      },
      include: { stops: true },
    })
    return ok(res, { trip: mapTrip(trip) }, 201)
  }),
)

tripsRouter.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.trip.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'الرحلة غير موجودة', 404)

    const body = z
      .object({
        busId: z.string().optional(),
        driverId: z.string().optional(),
        assistantName: z.string().optional(),
        assistantPhone: z.string().optional(),
        date: z.string().min(1).optional(),
        departureTime: z.string().min(1).optional(),
        price: z.number().positive().optional(),
        status: z.enum(['scheduled', 'departed', 'cancelled', 'completed']).optional(),
        stops: z.array(stopSchema).min(2).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const { stops, assistantName, assistantPhone, ...rest } = body.data
    if (stops) {
      await prisma.tripStop.deleteMany({ where: { tripId: paramId(req) } })
      await prisma.tripStop.createMany({
        data: stops.map((s, i) => ({
          tripId: paramId(req)!,
          destinationId: s.destinationId,
          point: s.point,
          sortOrder: i,
        })),
      })
    }

    const trip = await prisma.trip.update({
      where: { id: paramId(req) },
      data: {
        ...rest,
        ...(assistantName !== undefined ? { assistantName: assistantName.trim() } : {}),
        ...(assistantPhone !== undefined ? { assistantPhone: assistantPhone.trim() } : {}),
      },
      include: { stops: true },
    })
    return ok(res, { trip: mapTrip(trip) })
  }),
)

tripsRouter.post(
  '/:id/cancel',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const trip = await prisma.trip.update({
      where: { id: paramId(req) },
      data: { status: 'cancelled' },
      include: { stops: true },
    })
    return ok(res, { trip: mapTrip(trip) })
  }),
)
