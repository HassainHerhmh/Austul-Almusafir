import './loadEnv'
import { PrismaClient } from '@prisma/client'

const isProduction = process.env.NODE_ENV === 'production'

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret')) {
  throw new Error('JWT_SECRET مطلوب في بيئة الإنتاج')
}

/** * = السماح لأي أصل؛ أو قائمة مفصولة بفاصلة */
export function parseCorsOrigins(raw: string): string[] | true {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '*') return true
  const list = trimmed
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  return list.length > 0 ? list : true
}

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN || '*'),
}

export const prisma = new PrismaClient({
  log: isProduction ? [] : ['warn', 'error'],
})
