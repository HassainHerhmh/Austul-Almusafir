import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireRoles } from '../middleware/auth'
import {
  ensureOfficeLedgerAccount,
  postBookingCharge,
  postBookingCommission,
  reverseBookingCharge,
} from '../services/ledger'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

export const bookingsRouter = Router()
bookingsRouter.use(authRequired)

bookingsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const officeId =
      req.user!.role === 'admin'
        ? (req.query.officeId as string | undefined)
        : req.user!.officeId ?? undefined

    const list = await prisma.booking.findMany({
      where: officeId ? { officeId } : undefined,
      orderBy: { bookedAt: 'desc' },
    })
    return ok(res, {
      list: list.map((b) => ({
        ...b,
        bookedAt: b.bookedAt.toISOString(),
        bookedBy: b.bookedById,
      })),
    })
  }),
)

bookingsRouter.post(
  '/',
  requireRoles('admin', 'office_manager', 'booking_clerk'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        tripId: z.string(),
        officeId: z.string().optional(),
        passengerName: z.string().min(1),
        phone: z.string().min(1),
        nationalId: z.string().default(''),
        passportNumber: z.string().default(''),
        boardingDestinationId: z.string().min(1),
        seatNumber: z.number().int().positive(),
        paymentMethod: z.enum(['cash', 'transfer', 'credit']).default('cash'),
        notes: z.string().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات الحجز غير صالحة')

    const officeId =
      req.user!.role === 'admin'
        ? body.data.officeId
        : req.user!.officeId
    if (!officeId) return fail(res, 'المكتب مطلوب')

    const trip = await prisma.trip.findUnique({
      where: { id: body.data.tripId },
      include: { bus: true, stops: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!trip || trip.status !== 'scheduled') return fail(res, 'الرحلة غير متاحة للحجز')
    if (body.data.seatNumber < 1 || body.data.seatNumber > trip.bus.seats) {
      return fail(res, 'رقم المقعد غير صالح')
    }

    const routeIds = trip.stops.map((s) => s.destinationId)
    if (!routeIds.includes(body.data.boardingDestinationId)) {
      return fail(res, 'منطقة الصعود ليست من مدن مسار الرحلة')
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

    let ticketPrice = trip.price
    if (pricingMode === 'boarding') {
      const boarding = await prisma.destination.findUnique({
        where: { id: body.data.boardingDestinationId },
      })
      ticketPrice = Number(boarding?.ticketPrice) || 0
      if (ticketPrice <= 0) {
        return fail(res, 'لم يُحدَّد سعر تذكرة لمنطقة الصعود — راجع إدارة الوجهات')
      }
    }

    let customer = await prisma.customer.findFirst({
      where: {
        officeId,
        OR: [
          { phone: body.data.phone },
          ...(body.data.nationalId ? [{ nationalId: body.data.nationalId }] : []),
          ...(body.data.passportNumber
            ? [{ passportNumber: body.data.passportNumber }]
            : []),
        ],
      },
    })

    if (customer) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: body.data.passengerName,
          phone: body.data.phone,
          nationalId: body.data.nationalId,
          passportNumber: body.data.passportNumber,
        },
      })
    } else {
      customer = await prisma.customer.create({
        data: {
          name: body.data.passengerName,
          phone: body.data.phone,
          nationalId: body.data.nationalId,
          passportNumber: body.data.passportNumber,
          officeId,
        },
      })
    }

    const booking = await prisma.booking.create({
      data: {
        tripId: trip.id,
        officeId,
        customerId: customer.id,
        passengerName: body.data.passengerName,
        passportNumber: body.data.passportNumber,
        boardingDestinationId: body.data.boardingDestinationId,
        seatNumber: body.data.seatNumber,
        price: ticketPrice,
        paymentMethod: body.data.paymentMethod,
        notes: body.data.notes?.trim() ?? '',
        status: 'confirmed',
        bookedById: req.user!.id,
      },
    })

    await prisma.voucher.create({
      data: {
        officeId,
        type: 'receipt',
        amount: ticketPrice,
        description: `حجز ${body.data.passengerName} — مقعد ${body.data.seatNumber}`,
        date: new Date().toISOString().slice(0, 10),
        relatedBookingId: booking.id,
      },
    })

    let office = await prisma.office.findUnique({ where: { id: officeId } })
    if (office && !office.ledgerAccountId) {
      const ledgerAccountId = await ensureOfficeLedgerAccount(office.name)
      office = await prisma.office.update({
        where: { id: office.id },
        data: { ledgerAccountId },
      })
    }
    if (office?.ledgerAccountId) {
      await postBookingCharge({
        bookingId: booking.id,
        ledgerAccountId: office.ledgerAccountId,
        amount: booking.price,
        passengerName: booking.passengerName,
        seatNumber: booking.seatNumber,
      })
      await postBookingCommission({
        bookingId: booking.id,
        ledgerAccountId: office.ledgerAccountId,
        commissionPercent: office.commissionPercent,
        ticketPrice: booking.price,
        passengerName: booking.passengerName,
        seatNumber: booking.seatNumber,
      })
    }

    return ok(
      res,
      {
        booking: {
          ...booking,
          bookedAt: booking.bookedAt.toISOString(),
          bookedBy: booking.bookedById,
        },
      },
      201,
    )
  }),
)

bookingsRouter.patch(
  '/:id',
  requireRoles('admin', 'office_manager', 'booking_clerk'),
  asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { id: paramId(req) } })
    if (!booking) return fail(res, 'الحجز غير موجود', 404)
    if (req.user!.role !== 'admin' && booking.officeId !== req.user!.officeId) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }

    const body = z
      .object({
        passengerName: z.string().min(1).optional(),
        passportNumber: z.string().optional(),
        seatNumber: z.number().int().positive().optional(),
        status: z.enum(['confirmed', 'cancelled', 'refunded']).optional(),
        paymentMethod: z.enum(['cash', 'transfer', 'credit']).optional(),
        notes: z.string().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

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

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: body.data,
    })

    if (body.data.status === 'cancelled' && booking.status === 'confirmed') {
      await prisma.voucher.create({
        data: {
          officeId: booking.officeId,
          type: 'payment',
          amount: booking.price,
          description: `إلغاء حجز ${booking.passengerName}`,
          date: new Date().toISOString().slice(0, 10),
          relatedBookingId: booking.id,
        },
      })
      await reverseBookingCharge(booking.id)
    }

    return ok(res, {
      booking: {
        ...updated,
        bookedAt: updated.bookedAt.toISOString(),
        bookedBy: updated.bookedById,
      },
    })
  }),
)

