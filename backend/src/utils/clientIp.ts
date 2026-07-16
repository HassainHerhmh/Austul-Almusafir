import type { Request } from 'express'

/** عنوان IP الحقيقي خلف Railway / nginx */
export function clientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0]!.trim()
  }
  if (Array.isArray(xf) && xf[0]) return xf[0].trim()
  return req.ip || req.socket.remoteAddress || 'unknown'
}
