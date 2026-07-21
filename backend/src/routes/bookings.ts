import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireRoles } from '../middleware/auth'
import {
  findOfficeLedgerAccount,
  postBookingCharge,
  postBookingCommission,
  resolveCommissionsTransitAccount,
  resolveTicketRevenueTransitAccount,
  reverseBookingCharge,
} from '../services/ledger'
import { asyncHandler, fail, ok, paramId } from '../utils/http'
import { allocateBookingNumber } from '../services/bookingNumber'

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

bookingsRouter.get(
  '/seats',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      tripId: z.string().min(1),
    })
    const q = schema.safeParse(req.query)
    if (!q.success) return fail(res, 'tripId غير صالح')

    const tripId = q.data.tripId

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { bus: true },
    })
    if (!trip) return fail(res, 'الرحلة غير موجودة', 404)

    const bookings = await prisma.booking.findMany({
      where: { tripId, status: 'confirmed' },
      select: { seatNumber: true },
    })

    const seatSet = new Set<number>(bookings.map((b) => b.seatNumber))
    const bookedSeats = [...seatSet].sort((a, b) => a - b)
    const total = trip.bus?.seats ?? 0
    const booked = bookedSeats.length
    const remaining = Math.max(0, total - booked)

    return ok(res, { total, booked, remaining, bookedSeats })
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

    const officeId =
      req.user!.role === 'admin'
        ? body.data.officeId
        : req.user!.officeId
    if (!officeId) return fail(res, 'المكتب مطلوب')

    let office = await prisma.office.findUnique({ where: { id: officeId } })
    if (!office) return fail(res, 'المكتب غير موجود', 404)

    const trip = await prisma.trip.findUnique({
      where: { id: body.data.tripId },
      include: { bus: true, stops: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!trip || trip.status !== 'open') return fail(res, 'الرحلة غير متاحة للحجز')
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
          `المكتب غير مربوط بحساب ذمة — أنشئ حساب «${office.name}» تحت ذمم مكاتب السفريات واربطه من إدارة المكاتب`,
        )
      }

      const ticketTransit = await resolveTicketRevenueTransitAccount()
      if (!ticketTransit) {
        return fail(
          res,
          'حساب وسيط إيراد التذاكر غير موجود — أضفه يدوياً واضبطه من الحسابات الوسيطة',
        )
      }
      if ((office.commissionPercent || 0) > 0) {
        const commissionAcc = await resolveCommissionsTransitAccount()
        if (!commissionAcc) {
          return fail(
            res,
            'حساب عمولات المكاتب غير موجود — أضفه يدوياً واضبطه من الحسابات الوسيطة',
          )
        }
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

    // رحلة حملة: لا يُحسب سعر تذكرة على الوكيل — السعر الإجمالي على الرحلة فقط
    let ticketPrice = 0
    if (!isCampaign) {
      ticketPrice = trip.price
      if (pricingMode === 'boarding') {
        const boarding = await prisma.destination.findUnique({
          where: { id: body.data.boardingDestinationId },
        })
        ticketPrice = Number(boarding?.ticketPrice) || 0
        if (ticketPrice <= 0) {
          return fail(res, 'لم يُحدَّد سعر تذكرة لمنطقة الانطلاق — راجع إدارة الوجهات')
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
        ? await prisma.customer.findFirst({
            where: { officeId, OR: or },
          })
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
          notes: body.data.notes?.trim() ?? '',
          status: 'confirmed',
          bookedById: req.user!.id,
        },
      })
    })

    if (ticketPrice > 0 && ledgerAccountId) {
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
        ticketNumber: z.string().optional(),
        passportNumber: z.string().optional(),
        visaTypeId: z.string().optional(),
        boardingDestinationId: z.string().min(1).optional(),
        arrivalDestinationId: z.string().min(1).optional(),
        seatNumber: z.number().int().positive().optional(),
        status: z.enum(['confirmed', 'cancelled', 'refunded']).optional(),
        paymentMethod: z.enum(['cash', 'transfer', 'credit']).optional(),
        notes: z.string().optional(),
        /** تعديل السعر — للإدارة فقط */
        price: z.number().min(0).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    if (body.data.price !== undefined && req.user!.role !== 'admin') {
      return fail(res, 'تعديل سعر التذكرة متاح للإدارة فقط', 403)
    }
    if (body.data.price !== undefined && !Number.isFinite(body.data.price)) {
      return fail(res, 'سعر التذكرة غير صالح')
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
    if (body.data.price !== undefined) {
      data.price = Math.round(body.data.price * 100) / 100
    }

    const priceChanged =
      body.data.price !== undefined &&
      Math.round(body.data.price * 100) / 100 !== booking.price

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data,
    })

    if (priceChanged && updated.status === 'confirmed') {
      await reverseBookingCharge(booking.id)

      await prisma.voucher.updateMany({
        where: { relatedBookingId: booking.id, type: 'receipt' },
        data: { amount: updated.price },
      })

      const office = await prisma.office.findUnique({ where: { id: booking.officeId } })
      let ledgerAccountId = office?.ledgerAccountId ?? null
      if (!ledgerAccountId && office) {
        ledgerAccountId = await findOfficeLedgerAccount(office.name)
      }
      if (ledgerAccountId) {
        await postBookingCharge({
          bookingId: updated.id,
          ledgerAccountId,
          amount: updated.price,
          passengerName: updated.passengerName,
          seatNumber: updated.seatNumber,
        })
        await postBookingCommission({
          bookingId: updated.id,
          ledgerAccountId,
          commissionPercent: office?.commissionPercent ?? 0,
          ticketPrice: updated.price,
          passengerName: updated.passengerName,
          seatNumber: updated.seatNumber,
        })
      }
    }

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

bookingsRouter.delete(
  '/:id',
  requireRoles('admin'),
  asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { id: paramId(req) } })
    if (!booking) return fail(res, 'الحجز غير موجود', 404)

    // حذف قيود المحاسبة المرتبطة بالحجز (تذكرة + عمولة)
    await reverseBookingCharge(booking.id)

    // حذف سندات مرتبطة بالحجز
    await prisma.voucher.deleteMany({ where: { relatedBookingId: booking.id } })

    await prisma.booking.delete({ where: { id: booking.id } })
    return ok(res, { deleted: true })
  }),
)

