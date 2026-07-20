import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin } from '../middleware/auth'
import { asyncHandler, fail, ok } from '../utils/http'

export const settingsRouter = Router()

const TRANSIT_KEY = 'transit_accounts'
const PRICING_KEY = 'trip_pricing'
const BRAND_KEY = 'platform_brand'
const PRINT_KEY = 'print_settings'

type BrandValue = {
  name: string
  logoUrl: string | null
  phones: string
}

const DEFAULT_BRAND: BrandValue = {
  name: 'أسطول المسافر',
  logoUrl: null,
  phones: '',
}

type PrintValue = {
  primaryColor: string
  accentColor: string
  titleBgColor: string
  titleTextColor: string
  frameColor: string
  nameEn: string
  slogan: string
  address: string
  managementPhones: string
  servicePhones: string
  footerNote: string
}

const DEFAULT_PRINT: PrintValue = {
  primaryColor: '#1e3a5f',
  accentColor: '#c9a227',
  titleBgColor: '#1d2b44',
  titleTextColor: '#ffffff',
  frameColor: '#1e3a5f',
  nameEn: 'OSTOOL ALMOSAFER',
  slogan: 'الراحة.. وجهتنا',
  address: '',
  managementPhones: '',
  servicePhones: '',
  footerNote: 'هذا السند آلي ولا يحتاج ختم أو توقيع',
}

function readPrintValue(raw: Partial<PrintValue> | null): PrintValue {
  const pick = (v: unknown, fallback: string) =>
    typeof v === 'string' && v.trim() ? v.trim() : fallback
  return {
    primaryColor: pick(raw?.primaryColor, DEFAULT_PRINT.primaryColor),
    accentColor: pick(raw?.accentColor, DEFAULT_PRINT.accentColor),
    titleBgColor: pick(raw?.titleBgColor, DEFAULT_PRINT.titleBgColor),
    titleTextColor: pick(raw?.titleTextColor, DEFAULT_PRINT.titleTextColor),
    frameColor: pick(raw?.frameColor, DEFAULT_PRINT.frameColor),
    nameEn: pick(raw?.nameEn, DEFAULT_PRINT.nameEn),
    slogan: pick(raw?.slogan, DEFAULT_PRINT.slogan),
    address: typeof raw?.address === 'string' ? raw.address.trim() : '',
    managementPhones: typeof raw?.managementPhones === 'string' ? raw.managementPhones.trim() : '',
    servicePhones: typeof raw?.servicePhones === 'string' ? raw.servicePhones.trim() : '',
    footerNote: pick(raw?.footerNote, DEFAULT_PRINT.footerNote),
  }
}

async function readBrand(): Promise<BrandValue> {
  const row = await prisma.appSetting.findUnique({ where: { key: BRAND_KEY } })
  const raw = (row?.value as Partial<BrandValue> | null) ?? null
  return {
    name:
      typeof raw?.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : DEFAULT_BRAND.name,
    logoUrl:
      typeof raw?.logoUrl === 'string' && raw.logoUrl.trim() ? raw.logoUrl.trim() : null,
    phones: typeof raw?.phones === 'string' ? raw.phones.trim() : '',
  }
}

/** عام — صفحة الدخول قبل تسجيل الدخول */
settingsRouter.get(
  '/brand',
  asyncHandler(async (_req, res) => {
    return ok(res, { data: await readBrand() })
  }),
)

settingsRouter.use(authRequired)

settingsRouter.post(
  '/brand',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1).max(120),
        logoUrl: z.string().nullable().optional(),
        phones: z.string().max(500).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const logoUrl =
      body.data.logoUrl === undefined
        ? (await readBrand()).logoUrl
        : body.data.logoUrl && body.data.logoUrl.trim()
          ? body.data.logoUrl.trim()
          : null

    if (logoUrl && logoUrl.length > 1_200_000) {
      return fail(res, 'حجم الشعار كبير جداً')
    }

    const value: BrandValue = {
      name: body.data.name.trim() || DEFAULT_BRAND.name,
      logoUrl,
      phones: (body.data.phones ?? '').trim(),
    }

    await prisma.appSetting.upsert({
      where: { key: BRAND_KEY },
      create: { key: BRAND_KEY, value },
      update: { value },
    })

    return ok(res, { data: value })
  }),
)

settingsRouter.get(
  '/print',
  asyncHandler(async (_req, res) => {
    const row = await prisma.appSetting.findUnique({ where: { key: PRINT_KEY } })
    return ok(res, {
      data: readPrintValue((row?.value as Partial<PrintValue> | null) ?? null),
    })
  }),
)

settingsRouter.post(
  '/print',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        primaryColor: z.string().min(3).max(32).optional(),
        accentColor: z.string().min(3).max(32).optional(),
        titleBgColor: z.string().min(3).max(32).optional(),
        titleTextColor: z.string().min(3).max(32).optional(),
        frameColor: z.string().min(3).max(32).optional(),
        nameEn: z.string().max(120).optional(),
        slogan: z.string().max(120).optional(),
        address: z.string().max(300).optional(),
        managementPhones: z.string().max(200).optional(),
        servicePhones: z.string().max(200).optional(),
        footerNote: z.string().max(300).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const existing = await prisma.appSetting.findUnique({ where: { key: PRINT_KEY } })
    const prev = readPrintValue((existing?.value as Partial<PrintValue> | null) ?? null)
    const value = readPrintValue({ ...prev, ...body.data })

    await prisma.appSetting.upsert({
      where: { key: PRINT_KEY },
      create: { key: PRINT_KEY, value },
      update: { value },
    })

    return ok(res, { data: value })
  }),
)

type TransitValue = {
  office_commissions_account: number | null
  ticket_revenue_account: number | null
}

async function validateSubAccount(accountId: number | null) {
  if (!accountId) return { ok: true as const, accountId: null }
  const acc = await prisma.account.findUnique({ where: { id: accountId } })
  if (!acc) return { ok: false as const, message: 'الحساب غير موجود', status: 404 as const }
  if (acc.accountLevel !== 'فرعي') {
    const kids = await prisma.account.count({ where: { parentId: accountId } })
    if (acc.parentId && kids === 0) {
      await prisma.account.update({
        where: { id: accountId },
        data: { accountLevel: 'فرعي' },
      })
      return { ok: true as const, accountId }
    }
    return { ok: false as const, message: 'يجب اختيار حساب فرعي', status: 400 as const }
  }
  return { ok: true as const, accountId }
}

async function saveTransit(input: {
  office_commissions_account?: number | null
  ticket_revenue_account?: number | null
}) {
  const existing = await prisma.appSetting.findUnique({ where: { key: TRANSIT_KEY } })
  const prev = (existing?.value as Partial<TransitValue> | null) ?? {}

  let commissionsId =
    input.office_commissions_account !== undefined
      ? input.office_commissions_account
      : (prev.office_commissions_account ?? null)
  let ticketId =
    input.ticket_revenue_account !== undefined
      ? input.ticket_revenue_account
      : (prev.ticket_revenue_account ?? null)

  if (input.office_commissions_account !== undefined) {
    const v = await validateSubAccount(commissionsId)
    if (!v.ok) return v
    commissionsId = v.accountId
  }

  if (input.ticket_revenue_account !== undefined) {
    const v = await validateSubAccount(ticketId)
    if (!v.ok) return v
    ticketId = v.accountId
  }

  const value: TransitValue = {
    office_commissions_account: commissionsId,
    ticket_revenue_account: ticketId,
  }
  await prisma.appSetting.upsert({
    where: { key: TRANSIT_KEY },
    create: { key: TRANSIT_KEY, value },
    update: { value },
  })
  return { ok: true as const, value }
}

settingsRouter.get(
  '/transit-accounts',
  asyncHandler(async (_req, res) => {
    const row = await prisma.appSetting.findUnique({ where: { key: TRANSIT_KEY } })
    const raw = (row?.value as Partial<TransitValue> | null) ?? null
    return ok(res, {
      data: {
        office_commissions_account: raw?.office_commissions_account ?? null,
        ticket_revenue_account: raw?.ticket_revenue_account ?? null,
      },
    })
  }),
)

const transitBody = z.object({
  office_commissions_account: z.number().int().positive().nullable().optional(),
  ticket_revenue_account: z.number().int().positive().nullable().optional(),
})

settingsRouter.put(
  '/transit-accounts',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = transitBody.safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const result = await saveTransit(body.data)
    if (!result.ok) return fail(res, result.message, result.status)
    return ok(res, { data: result.value })
  }),
)

settingsRouter.post(
  '/transit-accounts',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = transitBody.safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const result = await saveTransit(body.data)
    if (!result.ok) return fail(res, result.message, result.status)
    return ok(res, { data: result.value })
  }),
)

export type PricingMode = 'trip' | 'boarding'

settingsRouter.get(
  '/pricing',
  asyncHandler(async (_req, res) => {
    const row = await prisma.appSetting.findUnique({ where: { key: PRICING_KEY } })
    const mode =
      (row?.value as { mode?: PricingMode } | null)?.mode === 'boarding' ? 'boarding' : 'trip'
    return ok(res, { data: { mode } })
  }),
)

settingsRouter.post(
  '/pricing',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z.object({ mode: z.enum(['trip', 'boarding']) }).safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const value = { mode: body.data.mode }
    await prisma.appSetting.upsert({
      where: { key: PRICING_KEY },
      create: { key: PRICING_KEY, value },
      update: { value },
    })
    return ok(res, { data: value })
  }),
)
