import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../config'
import { authRequired, signToken } from '../middleware/auth'
import {
  clearLoginRecord,
  loginBurstLimit,
  loginRateLimit,
  loginShield,
  recordLoginFailure,
} from '../middleware/loginGuard'
import { clientIp } from '../utils/clientIp'
import { asyncHandler, fail, ok } from '../utils/http'

export const authRouter = Router()

authRouter.post(
  '/login',
  loginShield,
  loginRateLimit,
  loginBurstLimit,
  asyncHandler(async (req, res) => {
    const ip = clientIp(req)
    const body = z
      .object({ username: z.string().min(1), password: z.string().min(1) })
      .safeParse(req.body)
    if (!body.success) return fail(res, 'بيانات الدخول غير مكتملة')

    const user = await prisma.user.findUnique({ where: { username: body.data.username.trim() } })
    if (!user || !user.active) {
      recordLoginFailure(ip)
      return fail(res, 'اسم المستخدم أو كلمة المرور غير صحيحة', 401)
    }

    const valid = await bcrypt.compare(body.data.password, user.passwordHash)
    if (!valid) {
      recordLoginFailure(ip)
      return fail(res, 'اسم المستخدم أو كلمة المرور غير صحيحة', 401)
    }

    if (user.officeId) {
      const office = await prisma.office.findUnique({ where: { id: user.officeId } })
      if (office?.status === 'suspended') {
        return fail(res, 'المكتب موقوف — راجع الوكالة', 403)
      }
    }

    clearLoginRecord(ip)

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      officeId: user.officeId,
    }
    const token = signToken(payload)

    return ok(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        phone: user.phone ?? '',
        role: user.role,
        officeId: user.officeId,
        active: user.active,
        permissions: user.permissions ?? null,
      },
    })
  }),
)

authRouter.get(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!user) return fail(res, 'المستخدم غير موجود', 404)
    if (!user.active) return fail(res, 'تم إيقاف حسابك', 403)
    return ok(res, {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        phone: user.phone ?? '',
        role: user.role,
        officeId: user.officeId,
        active: user.active,
        permissions: user.permissions ?? null,
      },
    })
  }),
)
