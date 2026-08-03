import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { partnerAuthRequired, requirePartnerPerm } from '../middleware/partnerAuth'
import { allocateBookingNumber } from '../services/bookingNumber'
import {
  findOfficeLedgerAccount,
  postBookingCharge,
  postBookingCommission,
  resolveCommissionsTransitAccount,
  resolveTicketRevenueTransitAccount,
  reverseBookingCharge,
} from '../services/ledger'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

export const partnerApiRouter = Router()
partnerApiRouter.use(partnerAuthRequired)

function publicBooking(b: {
  id: string
  bookingNumber: number | null
  tripId: string
  officeId: string
  passengerName: string
  ticketNumber: string
  passportNumber: string
  visaTypeId: string
  boardingDestinationId: string
  arrivalDestinationId: string
  seatNumber: number
  price: number
  paymentMethod: string
  notes: string
  status: string
  bookedAt: Date
}) {
  return {
    id: b.id,
    bookingNumber: b.bookingNumber,
    tripId: b.tripId,
    officeId: b.officeId,
    passengerName: b.passengerName,
    ticketNumber: b.ticketNumber,
    passportNumber: b.passportNumber,
    visaTypeId: b.visaTypeId,
    boardingDestinationId: b.boardingDestinationId,
    arrivalDestinationId: b.arrivalDestinationId,
    seatNumber: b.seatNumber,
    price: b.price,
    paymentMethod: b.paymentMethod,
    notes: b.notes,
    status: b.status,
    bookedAt: b.bookedAt.toISOString(),
  }
}

function tripLabel(
  stops: { destination?: { name: string } | null; point: string }[],
) {
  const names = stops
    .map((s) => s.destination?.name || s.point)
    .filter(Boolean)
  if (names.length < 2) return names[0] || ''
  return `${names[0]} ← ${names[names.length - 1]}`
}

/** رحلات مفتوحة متاحة للحجز على هذا المكتب */
partnerApiRouter.get(
  '/trips',
  asyncHandler(async (req, res) => {
    const officeId = req.partner!.officeId
    const list = await prisma.trip.findMany({
      where: {
        status: 'open',
        OR: [
          { tripKind: { not: 'campaign' } },
          { tripKind: 'campaign', campaignOfficeId: officeId },
        ],
      },
      include: {
        bus: { select: { id: true, busNumber: true, plateNumber: true, seats: true } },
        stops: {
          include: { destination: { select: { id: true, name: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ date: 'asc' }, { departureTime: 'asc' }],
    })

    return ok(res, {
      list: list.map((t) => ({
        id: t.id,
        date: t.date,
        departureTime: t.departureTime,
        status: t.status,
        tripKind: t.tripKind,
        pricingMode: t.pricingMode,
        price: t.tripKind === 'campaign' ? 0 : t.price,
        label: tripLabel(t.stops),
        bus: t.bus,
        stops: t.stops.map((s) => ({
          destinationId: s.destinationId,
          name: s.destination?.name ?? s.point,
          point: s.point,
        })),
      })),
    })
  }),
)

partnerApiRouter.get(
  '/trips/:tripId/seats',
  requirePartnerPerm('seatsView'),
  asyncHandler(async (req, res) => {
    const tripId = paramId(req, 'tripId')
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { bus: true },
    })
    if (!trip) return fail(res, 'الرحلة غير موجودة', 404)

    if (trip.tripKind === 'campaign' && trip.campaignOfficeId && trip.campaignOfficeId !== req.partner!.officeId) {
      return fail(res, 'ليس لديك صلاحية على هذه الرحلة', 403)
    }

    const bookings = await prisma.booking.findMany({
      where: { tripId, status: 'confirmed' },
      select: { seatNumber: true },
    })
    const seatSet = new Set<number>(bookings.map((b) => b.seatNumber))
    const bookedSeats = [...seatSet].sort((a, b) => a - b)
    const total = trip.bus?.seats ?? 0
    const booked = bookedSeats.length
    const remaining = Math.max(0, total - booked)

    return ok(res, { tripId, total, booked, remaining, bookedSeats })
  }),
)

partnerApiRouter.get(
  '/bookings',
  requirePartnerPerm('bookingsList'),
  asyncHandler(async (req, res) => {
    const officeId = req.partner!.officeId
    const tripId = typeof req.query.tripId === 'string' ? req.query.tripId : undefined
    const list = await prisma.booking.findMany({
      where: {
        officeId,
        ...(tripId ? { tripId } : {}),
      },
      orderBy: { bookedAt: 'desc' },
      take: 500,
    })
    return ok(res, { list: list.map(publicBooking) })
  }),
)

partnerApiRouter.post(
  '/bookings',
  requirePartnerPerm('bookingsCreate'),
  asyncHandler(async (req, res) => {
    const officeId = req.partner!.officeId
    const body = z
      .object({
        tripId: z.string(),
        passengerName: z.string().min(1),
        ticketNumber: z.string().min(1),
        phone: z.string().default(''),
        nationalId: z.string().default(''),
        passportNumber: z.string().default(''),
        visaTypeId: z.string().default(''),
        boardingDestinationId: z.string().min(1),
        arrivalDestinationId: z.string().min(1),
        seatNumber: z.number().int().positive(),
        paymentMethod: z.enum(['cash', 'transfer', 'credit']).default('cash'),
        notes: z.string().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات الحجز غير صالحة')

    let office = await prisma.office.findUnique({ where: { id: officeId } })
    if (!office) return fail(res, 'المكتب غير موجود', 404)
    if (office.status !== 'active') return fail(res, 'المكتب موقوف', 403)

    const trip = await prisma.trip.findUnique({
      where: { id: body.data.tripId },
      include: { bus: true, stops: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!trip || trip.status !== 'open') return fail(res, 'الرحلة غير متاحة للحجز')
    if (trip.tripKind === 'campaign' && trip.campaignOfficeId && trip.campaignOfficeId !== officeId) {
      return fail(res, 'هذه الحملة ليست لمكتبك', 403)
    }
    if (body.data.seatNumber < 1 || body.data.seatNumber > trip.bus.seats) {
      return fail(res, 'رقم المقعد غير صالح')
    }

    const isCampaign = trip.tripKind === 'campaign'

    let ledgerAccountId = office.ledgerAccountId
    if (!isCampaign) {
      if (!ledgerAccountId) {
        ledgerAccountId = await findOfficeLedgerAccount(office.name)
        if (ledgerAccountId) {
          office = await prisma.office.update({
            where: { id: office.id },
            data: { ledgerAccountId },
          })
        }
      }
      if (!ledgerAccountId) {
        return fail(
          res,
          `المكتب غير مربوط بحساب ذمة — اربطه من إدارة المكاتب`,
        )
      }
      const ticketTransit = await resolveTicketRevenueTransitAccount()
      if (!ticketTransit) {
        return fail(res, 'حساب وسيط إيراد التذاكر غير موجود')
      }
      if ((office.commissionPercent || 0) > 0) {
        const commissionAcc = await resolveCommissionsTransitAccount()
        if (!commissionAcc) return fail(res, 'حساب عمولات المكاتب غير موجود')
      }
    }

    const routeIds = trip.stops.map((s) => s.destinationId)
    if (!routeIds.includes(body.data.boardingDestinationId)) {
      return fail(res, 'منطقة الانطلاق ليست من مدن مسار الرحلة')
    }
    if (!routeIds.includes(body.data.arrivalDestinationId)) {
      return fail(res, 'منطقة الوصول ليست من مدن مسار الرحلة')
    }
    const boardIdx = routeIds.indexOf(body.data.boardingDestinationId)
    const arriveIdx = routeIds.indexOf(body.data.arrivalDestinationId)
    if (arriveIdx <= boardIdx) {
      return fail(res, 'منطقة الوصول يجب أن تكون بعد منطقة الانطلاق على المسار')
    }

    const taken = await prisma.booking.findFirst({
      where: {
        tripId: trip.id,
        seatNumber: body.data.seatNumber,
        status: 'confirmed',
      },
    })
    if (taken) return fail(res, 'هذا المقعد محجوز مسبقاً')

    const pricingMode = trip.pricingMode === 'boarding' ? 'boarding' : 'trip'
    let ticketPrice = 0
    if (!isCampaign) {
      ticketPrice = trip.price
      if (pricingMode === 'boarding') {
        const boarding = await prisma.destination.findUnique({
          where: { id: body.data.boardingDestinationId },
        })
        ticketPrice = Number(boarding?.ticketPrice) || 0
        if (ticketPrice <= 0) {
          return fail(res, 'لم يُحدَّد سعر تذكرة لمنطقة الانطلاق')
        }
      }
    }

    const phone = body.data.phone.trim()
    const or: Array<Record<string, string>> = []
    if (phone) or.push({ phone })
    if (body.data.nationalId) or.push({ nationalId: body.data.nationalId })
    if (body.data.passportNumber) or.push({ passportNumber: body.data.passportNumber })

    let customer =
      or.length > 0
        ? await prisma.customer.findFirst({ where: { officeId, OR: or } })
        : null

    if (customer) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: body.data.passengerName,
          phone: phone || customer.phone,
          nationalId: body.data.nationalId,
          passportNumber: body.data.passportNumber,
        },
      })
    } else {
      customer = await prisma.customer.create({
        data: {
          name: body.data.passengerName,
          phone,
          nationalId: body.data.nationalId,
          passportNumber: body.data.passportNumber,
          officeId,
        },
      })
    }

    const booking = await prisma.$transaction(async (tx) => {
      const bookingNumber = await allocateBookingNumber(tx)
      return tx.booking.create({
        data: {
          bookingNumber,
          tripId: trip.id,
          officeId,
          customerId: customer.id,
          passengerName: body.data.passengerName,
          ticketNumber: body.data.ticketNumber.trim(),
          passportNumber: body.data.passportNumber,
          visaTypeId: body.data.visaTypeId?.trim() || '',
          boardingDestinationId: body.data.boardingDestinationId,
          arrivalDestinationId: body.data.arrivalDestinationId,
          seatNumber: body.data.seatNumber,
          price: ticketPrice,
          paymentMethod: body.data.paymentMethod,
          notes: `${body.data.notes?.trim() || ''} [API:${req.partner!.name}]`.trim(),
          status: 'confirmed',
          bookedById: null,
        },
      })
    })

    if (ticketPrice > 0 && ledgerAccountId) {
      await prisma.voucher.create({
        data: {
          officeId,
          type: 'receipt',
          amount: ticketPrice,
          description: `حجز API ${body.data.passengerName} — مقعد ${body.data.seatNumber}`,
          date: new Date().toISOString().slice(0, 10),
          relatedBookingId: booking.id,
        },
      })
      await postBookingCharge({
        bookingId: booking.id,
        ledgerAccountId,
        amount: booking.price,
        passengerName: booking.passengerName,
        seatNumber: booking.seatNumber,
      })
      await postBookingCommission({
        bookingId: booking.id,
        ledgerAccountId,
        commissionPercent: office.commissionPercent,
        ticketPrice: booking.price,
        passengerName: booking.passengerName,
        seatNumber: booking.seatNumber,
      })
    }

    return ok(res, { booking: publicBooking(booking) }, 201)
  }),
)

partnerApiRouter.patch(
  '/bookings/:id',
  asyncHandler(async (req, res) => {
    const officeId = req.partner!.officeId
    const booking = await prisma.booking.findUnique({ where: { id: paramId(req) } })
    if (!booking) return fail(res, 'الحجز غير موجود', 404)
    if (booking.officeId !== officeId) return fail(res, 'ليس لديك صلاحية', 403)

    const body = z
      .object({
        passengerName: z.string().min(1).optional(),
        ticketNumber: z.string().optional(),
        passportNumber: z.string().optional(),
        visaTypeId: z.string().optional(),
        boardingDestinationId: z.string().min(1).optional(),
        arrivalDestinationId: z.string().min(1).optional(),
        seatNumber: z.number().int().positive().optional(),
        status: z.enum(['confirmed', 'cancelled', 'refunded']).optional(),
        paymentMethod: z.enum(['cash', 'transfer', 'credit']).optional(),
        notes: z.string().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const cancelling =
      body.data.status === 'cancelled' && booking.status === 'confirmed'
    const updatingFields = Object.keys(body.data).some((k) => k !== 'status')
    if (cancelling && !req.partner!.permissions.bookingsCancel) {
      return fail(res, 'ليس لديك صلاحية إلغاء الحجز', 403)
    }
    if (updatingFields && !req.partner!.permissions.bookingsUpdate) {
      return fail(res, 'ليس لديك صلاحية تعديل الحجز', 403)
    }
    if (
      body.data.status &&
      body.data.status !== 'cancelled' &&
      !req.partner!.permissions.bookingsUpdate
    ) {
      return fail(res, 'ليس لديك صلاحية تعديل الحجز', 403)
    }
    if (!cancelling && !updatingFields && body.data.status && !req.partner!.permissions.bookingsUpdate) {
      return fail(res, 'ليس لديك صلاحية تعديل الحجز', 403)
    }

    if (body.data.seatNumber && body.data.seatNumber !== booking.seatNumber) {
      const taken = await prisma.booking.findFirst({
        where: {
          tripId: booking.tripId,
          seatNumber: body.data.seatNumber,
          status: 'confirmed',
          NOT: { id: booking.id },
        },
      })
      if (taken) return fail(res, 'المقعد الجديد محجوز')
    }

    const nextBoard = body.data.boardingDestinationId ?? booking.boardingDestinationId
    const nextArrive = body.data.arrivalDestinationId ?? booking.arrivalDestinationId
    if (
      body.data.boardingDestinationId !== undefined ||
      body.data.arrivalDestinationId !== undefined
    ) {
      const trip = await prisma.trip.findUnique({
        where: { id: booking.tripId },
        include: { stops: { orderBy: { sortOrder: 'asc' } } },
      })
      const routeIds = trip?.stops.map((s) => s.destinationId) ?? []
      if (!routeIds.includes(nextBoard)) {
        return fail(res, 'منطقة الانطلاق ليست من مدن مسار الرحلة')
      }
      if (!routeIds.includes(nextArrive)) {
        return fail(res, 'منطقة الوصول ليست من مدن مسار الرحلة')
      }
      if (routeIds.indexOf(nextArrive) <= routeIds.indexOf(nextBoard)) {
        return fail(res, 'منطقة الوصول يجب أن تكون بعد منطقة الانطلاق على المسار')
      }
    }

    const data: Record<string, unknown> = { ...body.data }
    if (body.data.ticketNumber !== undefined) {
      data.ticketNumber = body.data.ticketNumber.trim()
    }
    if (body.data.visaTypeId !== undefined) {
      data.visaTypeId = body.data.visaTypeId.trim()
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data,
    })

    if (cancelling) {
      await prisma.voucher.create({
        data: {
          officeId: booking.officeId,
          type: 'payment',
          amount: booking.price,
          description: `إلغاء حجز API ${booking.passengerName}`,
          date: new Date().toISOString().slice(0, 10),
          relatedBookingId: booking.id,
        },
      })
      await reverseBookingCharge(booking.id)
    }

    return ok(res, { booking: publicBooking(updated) })
  }),
)

partnerApiRouter.delete(
  '/bookings/:id',
  requirePartnerPerm('bookingsDelete'),
  asyncHandler(async (req, res) => {
    const officeId = req.partner!.officeId
    const booking = await prisma.booking.findUnique({ where: { id: paramId(req) } })
    if (!booking) return fail(res, 'الحجز غير موجود', 404)
    if (booking.officeId !== officeId) return fail(res, 'ليس لديك صلاحية', 403)

    await reverseBookingCharge(booking.id)
    await prisma.voucher.deleteMany({ where: { relatedBookingId: booking.id } })
    await prisma.booking.delete({ where: { id: booking.id } })
    return ok(res, { deleted: true })
  }),
)
