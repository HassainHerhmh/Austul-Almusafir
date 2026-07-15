import './loadEnv'
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  corsOrigin: process.env.CORS_ORIGIN || '*',
}
