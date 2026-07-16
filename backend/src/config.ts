import './loadEnv'
import { PrismaClient } from '@prisma/client'

const isProduction = process.env.NODE_ENV === 'production'

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret')) {
  throw new Error('JWT_SECRET مطلوب في بيئة الإنتاج')
}

export const prisma = new PrismaClient({
  log: isProduction ? [] : ['warn', 'error'],
})

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  corsOrigin: process.env.CORS_ORIGIN || '*',
}
