import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin } from '../middleware/auth'
import {
  DEFAULT_TLB_PERMISSIONS,
  formatTlbAuthorityError,
  getActiveTlbApiKey,
  normalizeTlbPermissions,
  sendTlbPassengerForBooking,
  type TlbPermissions,
} from '../services/tlbPassengerApi'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

export const tlbApiKeysRouter = Router()
tlbApiKeysRouter.use(authRequired, requireAdmin)

const permissionsSchema = z.object({
  passengerSend: z.boolean(),
  autoOnBooking: z.boolean(),
  useHmacSignature: z.boolean(),
})

function maskKey(row: {
  apiId: number
  companyId: string
  apiNAme: string | null
  apiKey: string
  apiSecret: string
  apiBaseUrl: string
  isActive: number
  permissions: unknown
  createdAt: Date
  updatedAt: Date
}) {
  const mask = (s: string) => (s.length <= 6 ? '••••' : `${s.slice(0, 3)}…${s.slice(-2)}`)
  return {
    apiId: row.apiId,
    companyId: row.companyId,
    apiNAme: row.apiNAme ?? '',
    apiKeyMasked: mask(row.apiKey),
    apiSecretMasked: mask(row.apiSecret),
    apiBaseUrl: row.apiBaseUrl,
    isActive: row.isActive,
    permissions: normalizeTlbPermissions(row.permissions),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

tlbApiKeysRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const list = await prisma.tlbApiKey.findMany({ orderBy: { apiId: 'desc' } })
    return ok(res, { list: list.map(maskKey), active: list.some((r) => r.isActive === 1) })
  }),
)

tlbApiKeysRouter.get(
  '/active',
  asyncHandler(async (_req, res) => {
    const row = await getActiveTlbApiKey()
    if (!row) return ok(res, { configured: false })
    return ok(res, {
      configured: true,
      key: maskKey(row),
    })
  }),
)

tlbApiKeysRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        companyId: z.string().trim().min(1),
        apiNAme: z.string().trim().optional(),
        apiKey: z.string().trim().min(1),
        apiSecret: z.string().trim().min(1),
        apiBaseUrl: z.string().trim().optional(),
        isActive: z.number().int().min(0).max(1).optional(),
        permissions: permissionsSchema.default(DEFAULT_TLB_PERMISSIONS),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const permissions: TlbPermissions = normalizeTlbPermissions(body.data.permissions)
    const row = await prisma.tlbApiKey.create({
      data: {
        companyId: body.data.companyId,
        apiNAme: body.data.apiNAme?.trim() || null,
        apiKey: body.data.apiKey,
        apiSecret: body.data.apiSecret,
        apiBaseUrl: body.data.apiBaseUrl?.trim() ?? '',
        isActive: body.data.isActive ?? 1,
        permissions,
      },
    })
    return ok(res, { key: maskKey(row) }, 201)
  }),
)

tlbApiKeysRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const apiId = Number(paramId(req))
    if (!Number.isFinite(apiId)) return fail(res, 'معرّف غير صالح')
    const existing = await prisma.tlbApiKey.findUnique({ where: { apiId } })
    if (!existing) return fail(res, 'غير موجود', 404)

    const body = z
      .object({
        companyId: z.string().trim().min(1).optional(),
        apiNAme: z.string().trim().optional(),
        apiKey: z.string().trim().min(1).optional(),
        apiSecret: z.string().trim().min(1).optional(),
        apiBaseUrl: z.string().trim().optional(),
        isActive: z.number().int().min(0).max(1).optional(),
        permissions: permissionsSchema.optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const row = await prisma.tlbApiKey.update({
      where: { apiId },
      data: {
        ...(body.data.companyId !== undefined ? { companyId: body.data.companyId } : {}),
        ...(body.data.apiNAme !== undefined ? { apiNAme: body.data.apiNAme.trim() || null } : {}),
        ...(body.data.apiKey !== undefined ? { apiKey: body.data.apiKey } : {}),
        ...(body.data.apiSecret !== undefined ? { apiSecret: body.data.apiSecret } : {}),
        ...(body.data.apiBaseUrl !== undefined ? { apiBaseUrl: body.data.apiBaseUrl } : {}),
        ...(body.data.isActive !== undefined ? { isActive: body.data.isActive } : {}),
        ...(body.data.permissions !== undefined
          ? { permissions: normalizeTlbPermissions(body.data.permissions) }
          : {}),
      },
    })
    return ok(res, { key: maskKey(row) })
  }),
)

tlbApiKeysRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const apiId = Number(paramId(req))
    if (!Number.isFinite(apiId)) return fail(res, 'معرّف غير صالح')
    await prisma.tlbApiKey.delete({ where: { apiId } }).catch(() => null)
    return ok(res, { deleted: true })
  }),
)

tlbApiKeysRouter.post(
  '/test-passenger',
  asyncHandler(async (req, res) => {
    const body = z.object({ bookingId: z.string().min(1) }).safeParse(req.body)
    if (!body.success) return fail(res, 'معرّف الحجز مطلوب')
  const result = await sendTlbPassengerForBooking(body.data.bookingId, { force: true })
    if (result.skipped) return fail(res, `تخطي الإرسال: ${result.reason}`, 400)
    if (!result.ok) {
      const raw =
        'responseBody' in result && result.responseBody
          ? String(result.responseBody)
          : 'error' in result && result.error
            ? result.error
            : ''
      return fail(res, raw ? formatTlbAuthorityError(raw) : 'رفض السيرفر', 502)
    }
    return ok(res, result)
  }),
)