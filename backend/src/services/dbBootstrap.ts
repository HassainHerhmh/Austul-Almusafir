import { prisma } from '../config'
import { logger } from '../utils/logger'

function safePrismaMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  return err.message
    .replace(/mysql:\/\/[^\s'"]+/gi, 'mysql://[redacted]')
    .replace(/:\s*[^\s@]+@/g, ':[redacted]@')
}

/** تحقق من الاتصال قبل أي SQL خام أو migrations */
export async function ensurePrismaConnected(): Promise<boolean> {
  try {
    await prisma.$connect()
    await prisma.$queryRawUnsafe('SELECT 1')
    return true
  } catch (err) {
    const msg = safePrismaMessage(err)
    logger.error('db-bootstrap', msg)
    if (/engine|openssl|libssl|query engine/i.test(msg)) {
      logger.error(
        'db-bootstrap',
        'شغّل على السيرفر: cd backend && npm install && npx prisma generate && npm run build',
      )
    } else if (/credentials|access denied|ECONNREFUSED|ENOTFOUND|TLS/i.test(msg)) {
      logger.error('db-bootstrap', 'تحقق من MYSQLHOST / MYSQLUSER / MYSQLPASSWORD في لوحة Hostinger')
    }
    return false
  }
}