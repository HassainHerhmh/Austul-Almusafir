import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireAdmin, requireRoles } from '../middleware/auth'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

export const usersRouter = Router()
usersRouter.use(authRequired)

function publicUser(u: {
  id: string
  username: string
  name: string
  role: string
  officeId: string | null
  active: boolean
}) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    officeId: u.officeId,
    active: u.active,
  }
}

usersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const where =
      req.user!.role === 'admin'
        ? {}
        : { officeId: req.user!.officeId ?? '__none__' }
    const list = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } })
    return ok(res, { list: list.map(publicUser) })
  }),
)

usersRouter.post(
  '/',
  requireRoles('admin', 'office_manager'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        username: z.string().min(2),
        password: z.string().min(4),
        name: z.string().min(1),
        role: z.enum(['admin', 'office_manager', 'booking_clerk', 'accountant']),
        officeId: z.string().nullable().optional(),
        active: z.boolean().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    let officeId = body.data.officeId ?? null
    let role = body.data.role
    if (req.user!.role !== 'admin') {
      if (role === 'admin') return fail(res, 'لا يمكن إنشاء مدير نظام', 403)
      officeId = req.user!.officeId
    }

    const exists = await prisma.user.findUnique({ where: { username: body.data.username } })
    if (exists) return fail(res, 'اسم المستخدم مستخدم مسبقاً')

    const user = await prisma.user.create({
      data: {
        username: body.data.username,
        passwordHash: await bcrypt.hash(body.data.password, 10),
        name: body.data.name,
        role,
        officeId,
        active: body.data.active ?? true,
      },
    })
    return ok(res, { user: publicUser(user) }, 201)
  }),
)

usersRouter.put(
  '/:id',
  requireRoles('admin', 'office_manager'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'المستخدم غير موجود', 404)
    if (req.user!.role !== 'admin' && existing.officeId !== req.user!.officeId) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }

    const body = z
      .object({
        username: z.string().min(2).optional(),
        password: z.string().min(4).optional(),
        name: z.string().min(1).optional(),
        role: z.enum(['admin', 'office_manager', 'booking_clerk', 'accountant']).optional(),
        officeId: z.string().nullable().optional(),
        active: z.boolean().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات غير صالحة')

    const data: Record<string, unknown> = { ...body.data }
    delete data.password
    if (body.data.password) data.passwordHash = await bcrypt.hash(body.data.password, 10)
    if (req.user!.role !== 'admin') {
      delete data.officeId
      if (body.data.role === 'admin') return fail(res, 'غير مسموح', 403)
    }

    const user = await prisma.user.update({ where: { id: paramId(req) }, data })
    return ok(res, { user: publicUser(user) })
  }),
)

usersRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (paramId(req) === req.user!.id) return fail(res, 'لا يمكن حذف حسابك الحالي')
    await prisma.user.delete({ where: { id: paramId(req) } })
    return ok(res, { deleted: true })
  }),
)

