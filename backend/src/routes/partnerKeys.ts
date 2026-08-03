import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin } from '../middleware/auth'
import {
  DEFAULT_PARTNER_PERMISSIONS,
  generatePartnerApiKey,
  normalizePartnerPermissions,
  type PartnerPermissions,
} from '../middleware/partnerAuth'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

export const partnerKeysRouter = Router()
partnerKeysRouter.use(authRequired, requireAdmin)

const permissionsSchema = z.object({
  bookingsCreate: z.boolean(),
  bookingsUpdate: z.boolean(),
  bookingsCancel: z.boolean(),
  bookingsDelete: z.boolean(),
  bookingsList: z.boolean(),
  seatsView: z.boolean(),
})

function publicKey(row: {
  id: string
  name: string
  officeId: string
  keyPrefix: string
  permissions: unknown
  active: boolean
  lastUsedAt: Date | null
  createdAt: Date
  office?: { id: string; name: string } | null
}) {
  return {
    id: row.id,
    name: row.name,
    officeId: row.officeId,
    officeName: row.office?.name ?? '',
    keyPrefix: row.keyPrefix,
    permissions: normalizePartnerPermissions(row.permissions),
    active: row.active,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

partnerKeysRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const list = await prisma.partnerApiKey.findMany({
      include: { office: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return ok(res, { list: list.map(publicKey) })
  }),
)

partnerKeysRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(2),
        officeId: z.string().min(1),
        permissions: permissionsSchema.default(DEFAULT_PARTNER_PERMISSIONS),
        active: z.boolean().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const office = await prisma.office.findUnique({ where: { id: body.data.officeId } })
    if (!office) return fail(res, 'المكتب غير موجود', 404)

    const { apiKey, keyPrefix, keyHash } = generatePartnerApiKey()
    const permissions: PartnerPermissions = normalizePartnerPermissions(body.data.permissions)

    const row = await prisma.partnerApiKey.create({
      data: {
        name: body.data.name,
        officeId: body.data.officeId,
        keyPrefix,
        keyHash,
        permissions,
        active: body.data.active ?? true,
      },
      include: { office: { select: { id: true, name: true } } },
    })

    return ok(
      res,
      {
        key: publicKey(row),
        apiKey,
        baseUrl: '/api/partner/v1',
      },
      201,
    )
  }),
)

partnerKeysRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.partnerApiKey.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'الرابط غير موجود', 404)

    const body = z
      .object({
        name: z.string().trim().min(2).optional(),
        officeId: z.string().min(1).optional(),
        permissions: permissionsSchema.optional(),
        active: z.boolean().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    if (body.data.officeId) {
      const office = await prisma.office.findUnique({ where: { id: body.data.officeId } })
      if (!office) return fail(res, 'المكتب غير موجود', 404)
    }

    const row = await prisma.partnerApiKey.update({
      where: { id: existing.id },
      data: {
        ...(body.data.name !== undefined ? { name: body.data.name } : {}),
        ...(body.data.officeId !== undefined ? { officeId: body.data.officeId } : {}),
        ...(body.data.permissions !== undefined
          ? { permissions: normalizePartnerPermissions(body.data.permissions) }
          : {}),
        ...(body.data.active !== undefined ? { active: body.data.active } : {}),
      },
      include: { office: { select: { id: true, name: true } } },
    })

    return ok(res, { key: publicKey(row) })
  }),
)

partnerKeysRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.partnerApiKey.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'الرابط غير موجود', 404)
    await prisma.partnerApiKey.delete({ where: { id: existing.id } })
    return ok(res, { deleted: true })
  }),
)
