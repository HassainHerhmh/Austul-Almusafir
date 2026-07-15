import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin } from '../middleware/auth'
import { ensureCommissionsTransitAccount } from '../services/ledger'
import { asyncHandler, fail, ok } from '../utils/http'

export const settingsRouter = Router()
settingsRouter.use(authRequired)

const TRANSIT_KEY = 'transit_accounts'

async function saveTransit(officeCommissionsAccount: number | null) {
  let accountId = officeCommissionsAccount
  if (accountId) {
    const acc = await prisma.account.findUnique({ where: { id: accountId } })
    if (!acc) return { ok: false as const, message: 'الحساب غير موجود', status: 404 }
    if (acc.accountLevel !== 'فرعي') {
      return { ok: false as const, message: 'يجب اختيار حساب فرعي', status: 400 }
    }
  } else {
    accountId = await ensureCommissionsTransitAccount()
  }

  const value = { office_commissions_account: accountId }
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
    const raw = (row?.value as { office_commissions_account?: number | null } | null) ?? null
    let officeId = raw?.office_commissions_account ?? null
    if (!officeId) officeId = await ensureCommissionsTransitAccount()
    return ok(res, { data: { office_commissions_account: officeId } })
  }),
)

settingsRouter.put(
  '/transit-accounts',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({ office_commissions_account: z.number().int().positive().nullable() })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const result = await saveTransit(body.data.office_commissions_account)
    if (!result.ok) return fail(res, result.message, result.status)
    return ok(res, { data: result.value })
  }),
)

settingsRouter.post(
  '/transit-accounts',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({ office_commissions_account: z.number().int().positive().nullable() })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')
    const result = await saveTransit(body.data.office_commissions_account)
    if (!result.ok) return fail(res, result.message, result.status)
    return ok(res, { data: result.value })
  }),
)

const PRICING_KEY = 'trip_pricing'
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
