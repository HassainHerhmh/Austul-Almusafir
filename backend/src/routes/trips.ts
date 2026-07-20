import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin } from '../middleware/auth'
import {
  findOfficeLedgerAccount,
  postCampaignCharge,
  resolveTicketRevenueTransitAccount,
  reverseCampaignCharge,
} from '../services/ledger'
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
  busId: string
  driverId: string
  assistantName: string
  assistantPhone: string
  tripKind: string
  campaignOfficeId: string | null
  pricingMode: string
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
    tripKind: t.tripKind === 'campaign' ? 'campaign' : 'passenger',
    campaignOfficeId: t.campaignOfficeId ?? null,
    pricingMode: t.pricingMode === 'boarding' ? 'boarding' : 'trip',
    date: t.date,
    departureTime: t.departureTime,
    price: t.price,
    status: t.status,
    stops: [...t.stops]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({ destinationId: s.destinationId, point: s.point })),
  }
}

async function chargeCampaignOnOpen(trip: {
  id: string
  tripKind: string
  campaignOfficeId: string | null
  price: number
  date: string
}) {
  if (trip.tripKind !== 'campaign') return
  if (!(trip.price > 0)) {
    throw new Error('أدخل السعر الإجمالي للحملة قبل الفتح')
  }
  if (!trip.campaignOfficeId) {
    throw new Error('اختر مكتب/وكيل الحملة قبل فتح الرحلة')
  }

  const office = await prisma.office.findUnique({ where: { id: trip.campaignOfficeId } })
  if (!office) throw new Error('مكتب الحملة غير موجود')

  let ledgerAccountId = office.ledgerAccountId
  if (!ledgerAccountId) {
    ledgerAccountId = await findOfficeLedgerAccount(office.name)
    if (ledgerAccountId) {
      await prisma.office.update({
        where: { id: office.id },
        data: { ledgerAccountId },
      })
    }
  }
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

  // سند قبض للوكيل بمبلغ الحملة (مرة واحدة)
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
        tripKind: z.enum(['passenger', 'campaign']).optional(),
        campaignOfficeId: z.string().nullable().optional(),
        pricingMode: z.enum(['trip', 'boarding']).optional(),
        date: z.string().min(1),
        departureTime: z.string().min(1),
        price: z.number().min(0),
        status: TRIP_STATUS.optional(),
        stops: z.array(stopSchema).min(2),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات الرحلة غير صالحة')

    const tripKind = body.data.tripKind === 'campaign' ? 'campaign' : 'passenger'
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
    }

    const trip = await prisma.trip.create({
      data: {
        busId: body.data.busId,
        driverId: body.data.driverId,
        assistantName: body.data.assistantName?.trim() ?? '',
        assistantPhone: body.data.assistantPhone?.trim() ?? '',
        tripKind,
        campaignOfficeId,
        pricingMode,
        date: body.data.date,
        departureTime: body.data.departureTime,
        price: body.data.price,
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
        tripKind: z.enum(['passenger', 'campaign']).optional(),
        campaignOfficeId: z.string().nullable().optional(),
        pricingMode: z.enum(['trip', 'boarding']).optional(),
        date: z.string().min(1).optional(),
        departureTime: z.string().min(1).optional(),
        price: z.number().min(0).optional(),
        status: TRIP_STATUS.optional(),
        stops: z.array(stopSchema).min(2).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const { stops, assistantName, assistantPhone, pricingMode, tripKind, campaignOfficeId, ...rest } =
      body.data
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

    const trip = await prisma.trip.update({
      where: { id: paramId(req) },
      data: {
        ...rest,
        ...(assistantName !== undefined ? { assistantName: assistantName.trim() } : {}),
        ...(assistantPhone !== undefined ? { assistantPhone: assistantPhone.trim() } : {}),
        ...(tripKind !== undefined ? { tripKind: nextKind } : {}),
        campaignOfficeId: nextOfficeId,
        pricingMode: nextPricingMode,
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
  requireAdmin,
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
      await chargeCampaignOnOpen(existing)
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
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.trip.findUnique({
      where: { id: paramId(req) },
      include: { stops: true },
    })
    if (!existing) return fail(res, 'الرحلة غير موجودة', 404)
    if (existing.status === 'closed') {
      return ok(res, { trip: mapTrip(existing) })
    }
    if (existing.status !== 'open') {
      return fail(res, 'يمكن إقفال الرحلات المفتوحة فقط')
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
  requireAdmin,
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
      await chargeCampaignOnOpen(existing)
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
