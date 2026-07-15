import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin } from '../middleware/auth'
import { asyncHandler, fail, ok } from '../utils/http'

export const settingsRouter = Router()
settingsRouter.use(authRequired)

const TRANSIT_KEY = 'transit_accounts'

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
