import type { NextFunction, Request, Response } from 'express'

export function ok(res: Response, data: Record<string, unknown> = {}, status = 200) {
  return res.status(status).json({ success: true, ...data })
}

export function fail(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, message })
}

export function paramId(req: Request, name = 'id'): string {
  const v = req.params[name]
  return Array.isArray(v) ? String(v[0]) : String(v)
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
