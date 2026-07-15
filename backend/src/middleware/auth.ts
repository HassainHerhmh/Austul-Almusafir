import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'

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
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'جلسة غير صالحة' })
  }
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
