import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config, prisma } from '../config'

export type AuthUser = {
  id: string
  username: string
  role: string
  officeId: string | null
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, config.jwtSecret, { expiresIn: '7d' })
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'مطلوب تسجيل الدخول' })
  }
  try {
    req.user = jwt.verify(header.slice(7), config.jwtSecret) as AuthUser
  } catch {
    return res.status(401).json({ success: false, message: 'جلسة غير صالحة' })
  }

  void prisma.user
    .findUnique({
      where: { id: req.user.id },
      select: { active: true, role: true, officeId: true, username: true },
    })
    .then((dbUser) => {
      if (!dbUser) {
        return res.status(401).json({ success: false, message: 'جلسة غير صالحة' })
      }
      if (!dbUser.active) {
        return res.status(403).json({ success: false, message: 'تم إيقاف حسابك' })
      }
      // حافظ على بيانات JWT محدثة من قاعدة البيانات
      req.user = {
        id: req.user!.id,
        username: dbUser.username,
        role: dbUser.role,
        officeId: dbUser.officeId,
      }
      next()
    })
    .catch(next)
}

export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية' })
    }
    next()
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRoles('admin')(req, res, next)
}
