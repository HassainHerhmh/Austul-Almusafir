import { createHash, randomBytes } from 'crypto'
import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../config'

export type PartnerPermissions = {
  bookingsCreate: boolean
  bookingsUpdate: boolean
  bookingsCancel: boolean
  bookingsDelete: boolean
  bookingsList: boolean
  seatsView: boolean
}

export const DEFAULT_PARTNER_PERMISSIONS: PartnerPermissions = {
  bookingsCreate: false,
  bookingsUpdate: false,
  bookingsCancel: false,
  bookingsDelete: false,
  bookingsList: false,
  seatsView: false,
}

export type PartnerAuth = {
  keyId: string
  name: string
  officeId: string
  officeName: string
  permissions: PartnerPermissions
}

declare global {
  namespace Express {
    interface Request {
      partner?: PartnerAuth
    }
  }
}

export function normalizePartnerPermissions(raw: unknown): PartnerPermissions {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    bookingsCreate: !!src.bookingsCreate,
    bookingsUpdate: !!src.bookingsUpdate,
    bookingsCancel: !!src.bookingsCancel,
    bookingsDelete: !!src.bookingsDelete,
    bookingsList: !!src.bookingsList,
    seatsView: !!src.seatsView,
  }
}

export function hashPartnerApiKey(rawKey: string) {
  return createHash('sha256').update(rawKey).digest('hex')
}

/** يولد مفتاحاً ظاهراً مرة واحدة: ost_<prefix>_<secret> */
export function generatePartnerApiKey() {
  const prefixRand = randomBytes(3).toString('hex')
  const secret = randomBytes(24).toString('base64url')
  const keyPrefix = `ost_${prefixRand}`
  const apiKey = `${keyPrefix}_${secret}`
  return { apiKey, keyPrefix, keyHash: hashPartnerApiKey(apiKey) }
}

export function partnerAuthRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'مطلوب مفتاح API' })
  }

  const rawKey = header.slice(7).trim()
  if (!rawKey) {
    return res.status(401).json({ success: false, message: 'مطلوب مفتاح API' })
  }

  const keyHash = hashPartnerApiKey(rawKey)

  void prisma.partnerApiKey
    .findUnique({
      where: { keyHash },
      include: { office: { select: { id: true, name: true, status: true } } },
    })
    .then((row) => {
      if (!row || !row.active) {
        return res.status(401).json({ success: false, message: 'مفتاح API غير صالح' })
      }
      if (row.office.status !== 'active') {
        return res.status(403).json({ success: false, message: 'المكتب المرتبط موقوف' })
      }

      req.partner = {
        keyId: row.id,
        name: row.name,
        officeId: row.officeId,
        officeName: row.office.name,
        permissions: normalizePartnerPermissions(row.permissions),
      }

      // تحديث آخر استخدام بدون انتظار
      void prisma.partnerApiKey
        .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined)

      next()
    })
    .catch(next)
}

export function requirePartnerPerm(...keys: (keyof PartnerPermissions)[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.partner) {
      return res.status(401).json({ success: false, message: 'مطلوب مفتاح API' })
    }
    const okPerm = keys.every((k) => req.partner!.permissions[k])
    if (!okPerm) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية لهذه العملية' })
    }
    next()
  }
}
