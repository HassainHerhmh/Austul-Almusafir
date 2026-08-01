import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, requireRoles } from '../middleware/auth'
import { asyncHandler, fail, ok, paramId } from '../utils/http'

export const usersRouter = Router()
usersRouter.use(authRequired)

const pagePermSchema = z.object({
  view: z.boolean(),
  add: z.boolean(),
  edit: z.boolean(),
  delete: z.boolean(),
})

function publicUser(u: {
  id: string
  username: string
  name: string
  phone?: string | null
  role: string
  officeId: string | null
  driverId?: string | null
  active: boolean
  permissions?: unknown
}) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    phone: u.phone ?? '',
    role: u.role,
    officeId: u.officeId,
    driverId: u.driverId ?? null,
    active: u.active,
    permissions: (u.permissions as Record<string, unknown> | null) ?? null,
  }
}

function canManageUser(
  actor: { id: string; role: string; officeId: string | null },
  target: { officeId: string | null; role: string },
) {
  if (actor.role === 'admin') return true
  if (actor.role !== 'office_manager') return false
  if (!actor.officeId || target.officeId !== actor.officeId) return false
  if (target.role === 'admin' || target.role === 'driver') return false
  return true
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

const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v)
const emptyToUndef = (v: unknown) => (v === '' || v === undefined || v === null ? undefined : v)

const userRoleSchema = z.enum([
  'admin',
  'office_manager',
  'booking_clerk',
  'accountant',
  'driver',
])

function firstZodMessage(err: z.ZodError) {
  const issue = err.issues[0]
  if (!issue) return 'بيانات غير صالحة'
  const path = issue.path.join('.')
  if (path === 'password') return 'كلمة المرور يجب أن تكون 4 أحرف على الأقل'
  if (path === 'username') return 'اسم المستخدم قصير جداً'
  if (path === 'name') return 'الاسم مطلوب'
  if (path === 'role') return 'الدور غير صالح'
  if (path === 'officeId') return 'المكتب غير صالح'
  if (path === 'driverId') return 'السائق غير صالح'
  return 'بيانات غير صالحة'
}

usersRouter.post(
  '/',
  requireRoles('admin', 'office_manager'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        username: z.string().trim().min(2),
        password: z.string().min(4),
        name: z.string().trim().min(1),
        phone: z.preprocess(emptyToUndef, z.string().optional()),
        role: userRoleSchema,
        officeId: z.preprocess(emptyToNull, z.string().nullable().optional()),
        driverId: z.preprocess(emptyToNull, z.string().nullable().optional()),
        active: z.boolean().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, firstZodMessage(body.error))

    let officeId = body.data.officeId ?? null
    let role = body.data.role
    let driverId = body.data.driverId ?? null

    if (req.user!.role !== 'admin') {
      if (role === 'admin' || role === 'driver') return fail(res, 'لا يمكن إنشاء هذا الدور', 403)
      officeId = req.user!.officeId
      driverId = null
    }

    if (role === 'driver') {
      officeId = null
      if (!driverId) return fail(res, 'اختر السائق المرتبط بالحساب')
      const driver = await prisma.driver.findUnique({ where: { id: driverId } })
      if (!driver) return fail(res, 'السائق غير موجود', 404)
      const other = await prisma.user.findFirst({ where: { driverId } })
      if (other) return fail(res, 'هذا السائق مربوط بحساب آخر مسبقاً')
    } else {
      driverId = null
    }

    const exists = await prisma.user.findUnique({ where: { username: body.data.username } })
    if (exists) return fail(res, 'اسم المستخدم مستخدم مسبقاً')

    const user = await prisma.user.create({
      data: {
        username: body.data.username,
        passwordHash: await bcrypt.hash(body.data.password, 10),
        name: body.data.name,
        phone: (body.data.phone ?? '').trim(),
        role,
        officeId,
        driverId,
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
    if (!canManageUser(req.user!, existing)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }

    const body = z
      .object({
        username: z.string().trim().min(2).optional(),
        password: z.preprocess(emptyToUndef, z.string().min(4).optional()),
        name: z.string().trim().min(1).optional(),
        phone: z.preprocess(emptyToUndef, z.string().optional()),
        role: userRoleSchema.optional(),
        officeId: z.preprocess(emptyToNull, z.string().nullable().optional()),
        driverId: z.preprocess(emptyToNull, z.string().nullable().optional()),
        active: z.boolean().optional(),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, firstZodMessage(body.error))

    const data: Record<string, unknown> = { ...body.data }
    delete data.password
    if (body.data.password) data.passwordHash = await bcrypt.hash(body.data.password, 10)
    if (body.data.phone !== undefined) data.phone = body.data.phone.trim()
    if (req.user!.role !== 'admin') {
      delete data.officeId
      delete data.driverId
      if (body.data.role === 'admin' || body.data.role === 'driver') {
        return fail(res, 'غير مسموح', 403)
      }
    }

    const nextRole = body.data.role ?? existing.role
    if (nextRole === 'driver') {
      data.officeId = null
      const nextDriverId =
        body.data.driverId !== undefined ? body.data.driverId : existing.driverId
      if (!nextDriverId) return fail(res, 'اختر السائق المرتبط بالحساب')
      const driver = await prisma.driver.findUnique({ where: { id: nextDriverId } })
      if (!driver) return fail(res, 'السائق غير موجود', 404)
      const other = await prisma.user.findFirst({
        where: { driverId: nextDriverId, NOT: { id: existing.id } },
      })
      if (other) return fail(res, 'هذا السائق مربوط بحساب آخر مسبقاً')
      data.driverId = nextDriverId
    } else if (body.data.role !== undefined || body.data.driverId !== undefined) {
      data.driverId = null
    }

    const user = await prisma.user.update({ where: { id: paramId(req) }, data })
    return ok(res, { user: publicUser(user) })
  }),
)

usersRouter.get(
  '/:id/permissions',
  requireRoles('admin', 'office_manager'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'المستخدم غير موجود', 404)
    if (!canManageUser(req.user!, existing)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
    return ok(res, {
      permissions: (existing.permissions as Record<string, unknown> | null) ?? null,
    })
  }),
)

usersRouter.put(
  '/:id/permissions',
  requireRoles('admin', 'office_manager'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'المستخدم غير موجود', 404)
    if (!canManageUser(req.user!, existing)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }

    const body = z
      .object({
        permissions: z.record(pagePermSchema),
      })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات الصلاحيات غير صالحة')

    const user = await prisma.user.update({
      where: { id: paramId(req) },
      data: { permissions: body.data.permissions },
    })
    return ok(res, { user: publicUser(user) })
  }),
)

usersRouter.delete(
  '/:id',
  requireRoles('admin', 'office_manager'),
  asyncHandler(async (req, res) => {
    if (paramId(req) === req.user!.id) return fail(res, 'لا يمكن حذف حسابك الحالي')
    const existing = await prisma.user.findUnique({ where: { id: paramId(req) } })
    if (!existing) return fail(res, 'المستخدم غير موجود', 404)
    if (!canManageUser(req.user!, existing)) {
      return fail(res, 'ليس لديك صلاحية', 403)
    }
    if (existing.role === 'admin') return fail(res, 'لا يمكن حذف مدير النظام', 403)

    await prisma.user.delete({ where: { id: paramId(req) } })
    return ok(res, { deleted: true })
  }),
)
