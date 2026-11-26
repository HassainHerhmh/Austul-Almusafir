import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAgencyAdmin, type AuthUser } from '../middleware/auth'
import { branchIdOnCreate, tripsListWhere } from '../utils/branchScope'
import {
  postCampaignCharge,
  resolveTicketRevenueTransitAccount,
  reverseCampaignCharge,
} from '../services/ledger'
import { allocateTripNumber } from '../services/tripNumber'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

export const tripsRouter = Router()
tripsRouter.use(authRequired)

const TRIP_STATUS = z.enum([
  'scheduled',
  'open',
  'closed',
  'departed',
  'cancelled',
  'completed',
])

const stopSchema = z.object({
  destinationId: z.string().min(1),
  point: z.string().optional(),
})

function mapTrip(t: {
  id: string
  tripNumber: number | null
  busId: string
  driverId: string
  assistantName: string
  assistantPhone: string
  tripKind: string
  campaignOfficeId: string | null
  pricingMode: string
  date: string
  checkInTime: string
  departureTime: string
  price: number
  childPrice: number | null
  status: string
  stops: { destinationId: string; point: string; sortOrder: number }[]
}) {
  return {
    id: t.id,
    tripNumber: t.tripNumber,
    busId: t.busId,
    driverId: t.driverId,
    assistantName: t.assistantName ?? '',
    assistantPhone: t.assistantPhone ?? '',
    tripKind: t.tripKind === 'campaign' ? 'campaign' : 'passenger',
    campaignOfficeId: t.campaignOfficeId ?? null,
    pricingMode: t.pricingMode === 'boarding' ? 'boarding' : 'trip',
    date: t.date,
    checkInTime: t.checkInTime ?? '',
    departureTime: t.departureTime,
    price: t.price,
    childPrice: t.childPrice ?? null,
    status: t.status,
    stops: [...t.stops]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({ destinationId: s.destinationId, point: s.point })),
  }
}

/** مدير الفرع يربط الرحلة بباص/سائق من أسطول الوكالة فقط */
async function assertBranchTripFleet(user: AuthUser, busId: string, driverId: string) {
  if (user.role !== 'branch_admin') return true
  const [bus, driver] = await Promise.all([
    prisma.bus.findUnique({ where: { id: busId }, select: { branchId: true } }),
    prisma.driver.findUnique({ where: { id: driverId }, select: { branchId: true } }),
  ])
  if (!bus || !driver) return false
  return bus.branchId === null && driver.branchId === null
}

/** قيد إجمالي الحملة على الوكيل — يُستدعى عند الفتح أو الإقفال/الاكتمال (idempotent) */
async function ensureCampaignCharge(trip: {
  id: string
  tripKind: string
  campaignOfficeId: string | null
  price: number
  date: string
}) {
  if (trip.tripKind !== 'campaign') return
  if (!(trip.price > 0)) {
    throw new Error('أدخل السعر الإجمالي للحملة قبل تسجيل القيد')
  }
  if (!trip.campaignOfficeId) {
    throw new Error('اختر مكتب/وكيل الحملة قبل تسجيل القيد')
  }

  const office = await prisma.office.findUnique({ where: { id: trip.campaignOfficeId } })
  if (!office) throw new Error('مكتب الحملة غير موجود')

  const ledgerAccountId = office.ledgerAccountId
  if (!ledgerAccountId) {
    throw new Error(
      `المكتب «${office.name}» غير مربوط بحساب ذمة — اربطه من إدارة المكاتب`,
    )
  }

  const transit = await resolveTicketRevenueTransitAccount()
  if (!transit) {
    throw new Error(
      'حساب وسيط إيراد التذاكر غير موجود — أضفه يدوياً واضبطه من الحسابات الوسيطة',
    )
  }

  await postCampaignCharge({
    tripId: trip.id,
    ledgerAccountId,
    amount: trip.price,
    officeName: office.name,
    tripDate: trip.date,
  })

  // سند قبض للوكيل بمبلغ الحملة (مرة واحدة) — لا يشترط حجوزات ركاب
  const alreadyVoucher = await prisma.voucher.findFirst({
    where: {
      officeId: office.id,
      type: 'receipt',
      description: { contains: trip.id },
    },
  })
  if (!alreadyVoucher) {
    await prisma.voucher.create({
      data: {
        officeId: office.id,
        type: 'receipt',
        amount: trip.price,
        description: `حملة — رحلة ${trip.date} (${trip.id})`,
        date: new Date().toISOString().slice(0, 10),
      },
    })
  }
}

tripsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await prisma.trip.findMany({
      where: await tripsListWhere(req.user!),
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

tripsRouter.post(
  '/',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        busId: z.string(),
        driverId: z.string(),
        assistantName: z.string().optional(),
        assistantPhone: z.string().optional(),
        tripKind: z.enum(['passenger', 'campaign']).optional(),
        campaignOfficeId: z.string().nullable().optional(),
        pricingMode: z.enum(['trip', 'boarding']).optional(),
        date: z.string().min(1),
        checkInTime: z.string().optional(),
        departureTime: z.string().min(1),
        price: z.number().min(0),
        childPrice: z.number().min(0).nullable().optional(),
        status: TRIP_STATUS.optional(),
        stops: z.array(stopSchema).min(2),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات الرحلة غير صالحة')

    const tripKind = body.data.tripKind === 'campaign' ? 'campaign' : 'passenger'
    if (req.user!.role === 'branch_admin' && tripKind === 'campaign') {
      return fail(res, 'الحملة تُنشأ من لوحة الوكالة فقط', 403)
    }
    const campaignOfficeId =
      tripKind === 'campaign' ? body.data.campaignOfficeId?.trim() || null : null
    const pricingMode =
      tripKind === 'campaign'
        ? 'trip'
        : body.data.pricingMode === 'boarding'
          ? 'boarding'
          : 'trip'
    if (tripKind === 'campaign' && body.data.price <= 0) {
      return fail(res, 'أدخل السعر الإجمالي للحملة')
    }
    if (tripKind === 'campaign' && !campaignOfficeId) {
      return fail(res, 'اختر مكتب/وكيل الحملة')
    }
    if (tripKind === 'passenger' && pricingMode === 'trip' && body.data.price <= 0) {
      return fail(res, 'أدخل سعر التذكرة للرحلة')
    }

    if (campaignOfficeId) {
      const office = await prisma.office.findUnique({ where: { id: campaignOfficeId } })
      if (!office) return fail(res, 'مكتب الحملة غير موجود', 404)
      if (
        req.user!.role === 'branch_admin' &&
        office.branchId !== req.user!.branchId
      ) {
        return fail(res, 'مكتب الحملة خارج نطاق الفرع', 403)
      }
    }

    if (!(await assertBranchTripFleet(req.user!, body.data.busId, body.data.driverId))) {
      return fail(res, 'اختر باصاً وسائقاً من أسطول الوكالة', 400)
    }

    const trip = await prisma.$transaction(async (tx) => {
      const tripNumber = await allocateTripNumber(tx)
      return tx.trip.create({
      data: {
        tripNumber,
        branchId: branchIdOnCreate(req.user!),
        busId: body.data.busId,
        driverId: body.data.driverId,
        assistantName: body.data.assistantName?.trim() ?? '',
        assistantPhone: body.data.assistantPhone?.trim() ?? '',
        tripKind,
        campaignOfficeId,
        pricingMode,
        date: body.data.date,
        checkInTime: body.data.checkInTime?.trim() ?? '',
        departureTime: body.data.departureTime,
        price: body.data.price,
        childPrice:
          tripKind === 'passenger' && body.data.childPrice != null ? body.data.childPrice : null,
        status: body.data.status ?? 'scheduled',
        stops: {
          create: body.data.stops.map((s, i) => ({
            destinationId: s.destinationId,
            point: s.point ?? '',
            sortOrder: i,
          })),
        },
      },
      include: { stops: true },
    })
    })
    return ok(res, { trip: mapTrip(trip) }, 201)
  }),
)

tripsRouter.put(
  '/:id',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.trip.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'الرحلة غير موجودة', 404)

    const body = z
      .object({
        busId: z.string().optional(),
        driverId: z.string().optional(),
        assistantName: z.string().optional(),
        assistantPhone: z.string().optional(),
        tripKind: z.enum(['passenger', 'campaign']).optional(),
        campaignOfficeId: z.string().nullable().optional(),
        pricingMode: z.enum(['trip', 'boarding']).optional(),
        date: z.string().min(1).optional(),
        checkInTime: z.string().optional(),
        departureTime: z.string().min(1).optional(),
        price: z.number().min(0).optional(),
        childPrice: z.number().min(0).nullable().optional(),
        status: TRIP_STATUS.optional(),
        stops: z.array(stopSchema).min(2).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const {
      stops,
      assistantName,
      assistantPhone,
      pricingMode,
      tripKind,
      campaignOfficeId,
      childPrice,
      ...rest
    } = body.data
    if (stops) {
      await prisma.tripStop.deleteMany({ where: { tripId: paramId(req) } })
      await prisma.tripStop.createMany({
        data: stops.map((s, i) => ({
          tripId: paramId(req)!,
          destinationId: s.destinationId,
          point: s.point ?? '',
          sortOrder: i,
        })),
      })
    }

    const nextKind =
      tripKind !== undefined
        ? tripKind === 'campaign'
          ? 'campaign'
          : 'passenger'
        : existing.tripKind === 'campaign'
          ? 'campaign'
          : 'passenger'
    if (req.user!.role === 'branch_admin' && nextKind === 'campaign') {
      return fail(res, 'الحملة تُدار من لوحة الوكالة فقط', 403)
    }
    const nextOfficeId =
      nextKind === 'campaign'
        ? campaignOfficeId !== undefined
          ? campaignOfficeId?.trim() || null
          : existing.campaignOfficeId
        : null
    const nextPrice = rest.price !== undefined ? rest.price : existing.price
    const nextPricingMode =
      nextKind === 'campaign'
        ? 'trip'
        : pricingMode !== undefined
          ? pricingMode === 'boarding'
            ? 'boarding'
            : 'trip'
          : existing.pricingMode === 'boarding'
            ? 'boarding'
            : 'trip'

    if (nextKind === 'campaign' && nextPrice <= 0) {
      return fail(res, 'أدخل السعر الإجمالي للحملة')
    }
    if (nextKind === 'campaign' && !nextOfficeId) {
      return fail(res, 'اختر مكتب/وكيل الحملة')
    }
    if (nextKind === 'passenger' && nextPricingMode === 'trip' && nextPrice <= 0) {
      return fail(res, 'أدخل سعر التذكرة للرحلة')
    }

    if (nextOfficeId) {
      const office = await prisma.office.findUnique({ where: { id: nextOfficeId } })
      if (!office) return fail(res, 'مكتب الحملة غير موجود', 404)
    }

    const nextBusId = rest.busId ?? existing.busId
    const nextDriverId = rest.driverId ?? existing.driverId
    if (!(await assertBranchTripFleet(req.user!, nextBusId, nextDriverId))) {
      return fail(res, 'اختر باصاً وسائقاً من أسطول الوكالة', 400)
    }

    const trip = await prisma.trip.update({
      where: { id: paramId(req) },
      data: {
        ...rest,
        ...(rest.checkInTime !== undefined ? { checkInTime: rest.checkInTime.trim() } : {}),
        ...(childPrice !== undefined
          ? { childPrice: nextKind === 'passenger' ? childPrice : null }
          : {}),
        ...(assistantName !== undefined ? { assistantName: assistantName.trim() } : {}),
        ...(assistantPhone !== undefined ? { assistantPhone: assistantPhone.trim() } : {}),
        ...(tripKind !== undefined ? { tripKind: nextKind } : {}),
        campaignOfficeId: nextOfficeId,
        pricingMode: nextPricingMode,
      },
      include: { stops: true },
    })

    // حملة مقفلة/مكتملة: سجّل إجمالي الحملة على الوكيل حتى بدون إدخال ركاب
    if (
      trip.tripKind === 'campaign' &&
      (trip.status === 'closed' || trip.status === 'completed')
    ) {
      try {
        await ensureCampaignCharge({
          id: trip.id,
          tripKind: trip.tripKind,
          campaignOfficeId: trip.campaignOfficeId,
          price: trip.price,
          date: trip.date,
        })
      } catch (e) {
        return fail(res, e instanceof Error ? e.message : 'تعذر تسجيل قيد الحملة', 400)
      }
    }

    return ok(res, { trip: mapTrip(trip) })
  }),
)

tripsRouter.post(
  '/:id/cancel',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.trip.findUnique({
      where: { id: paramId(req) },
      include: { stops: true },
    })
    if (!existing) return fail(res, 'الرحلة غير موجودة', 404)

    if (existing.tripKind === 'campaign') {
      await reverseCampaignCharge(existing.id)
    }

    const trip = await prisma.trip.update({
      where: { id: paramId(req) },
      data: { status: 'cancelled' },
      include: { stops: true },
    })
    return ok(res, { trip: mapTrip(trip) })
  }),
)

/** فتح الرحلة للحجز عند الوكلاء — وللحملة يُقيَّد الإجمالي على الوكيل فوراً */
tripsRouter.post(
  '/:id/open',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.trip.findUnique({
      where: { id: paramId(req) },
      include: { stops: true },
    })
    if (!existing) return fail(res, 'الرحلة غير موجودة', 404)
    if (existing.status === 'open') {
      return ok(res, { trip: mapTrip(existing) })
    }
    if (existing.status !== 'scheduled' && existing.status !== 'closed') {
      return fail(res, 'يمكن فتح الرحلات المجدولة أو المقفلة فقط')
    }

    try {
      await ensureCampaignCharge(existing)
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'تعذر تسجيل قيد الحملة', 400)
    }

    const trip = await prisma.trip.update({
      where: { id: paramId(req) },
      data: { status: 'open' },
      include: { stops: true },
    })
    return ok(res, { trip: mapTrip(trip) })
  }),
)

tripsRouter.post(
  '/:id/close',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.trip.findUnique({
      where: { id: paramId(req) },
      include: { stops: true },
    })
    if (!existing) return fail(res, 'الرحلة غير موجودة', 404)
    if (existing.status === 'closed') {
      // حتى لو كانت مقفلة مسبقاً: تأكد من قيد الحملة (لا يشترط حجوزات)
      try {
        await ensureCampaignCharge(existing)
      } catch (e) {
        return fail(res, e instanceof Error ? e.message : 'تعذر تسجيل قيد الحملة', 400)
      }
      return ok(res, { trip: mapTrip(existing) })
    }
    if (existing.status !== 'open' && existing.status !== 'completed' && existing.status !== 'departed') {
      return fail(res, 'يمكن إقفال الرحلات المفتوحة أو المكتملة/المنطلقة فقط')
    }

    try {
      await ensureCampaignCharge(existing)
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'تعذر تسجيل قيد الحملة', 400)
    }

    const trip = await prisma.trip.update({
      where: { id: paramId(req) },
      data: { status: 'closed' },
      include: { stops: true },
    })
    return ok(res, { trip: mapTrip(trip) })
  }),
)

tripsRouter.post(
  '/:id/reopen',
  requireAgencyAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.trip.findUnique({
      where: { id: paramId(req) },
      include: { stops: true },
    })
    if (!existing) return fail(res, 'الرحلة غير موجودة', 404)
    if (existing.status === 'open') {
      return ok(res, { trip: mapTrip(existing) })
    }
    if (existing.status !== 'closed') {
      return fail(res, 'يمكن إعادة فتح الرحلات المقفلة فقط')
    }

    try {
      await ensureCampaignCharge(existing)
    } catch (e) {
      return fail(res, e instanceof Error ? e.message : 'تعذر تسجيل قيد الحملة', 400)
    }

    const trip = await prisma.trip.update({
      where: { id: paramId(req) },
      data: { status: 'open' },
      include: { stops: true },
    })
    return ok(res, { trip: mapTrip(trip) })
  }),
)
