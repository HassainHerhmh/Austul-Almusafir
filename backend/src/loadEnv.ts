import 'dotenv/config'
import { logger } from './utils/logger'

/**
 * Railway: نفضّل MYSQL_PUBLIC_URL — العنوان الداخلي (.internal) قد يفشل.
 * Hostinger: DATABASE_URL مع localhost صحيح (MySQL على نفس السيرفر).
 */
export function ensureDatabaseUrl() {
  const isBuildPlaceholder = (url?: string) =>
    !!url && /mysql:\/\/build:/.test(url)

  const withPool = (url: string) => {
    if (/[?&]connection_limit=/.test(url)) return url
    return url.includes('?') ? `${url}&connection_limit=5` : `${url}?connection_limit=5`
  }

  const fromParts = (host: string, port?: string) => {
    const user = encodeURIComponent(process.env.MYSQLUSER || 'root')
    const pass = encodeURIComponent(process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || '')
    const db = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'railway'
    return `mysql://${user}:${pass}@${host}:${port || '3306'}/${db}`
  }

  let chosen: string | undefined
  let via = 'unknown'

  const explicitDb = process.env.DATABASE_URL?.trim()
  if (explicitDb && !isBuildPlaceholder(explicitDb)) {
    chosen = explicitDb
    via = 'DATABASE_URL'
  } else if (process.env.FORCE_PRIVATE_MYSQL === '1' && process.env.MYSQL_PRIVATE_URL) {
    chosen = process.env.MYSQL_PRIVATE_URL
    via = 'private (forced)'
  } else if (process.env.MYSQL_PUBLIC_URL && !isBuildPlaceholder(process.env.MYSQL_PUBLIC_URL)) {
    chosen = process.env.MYSQL_PUBLIC_URL
    via = 'public'
  } else if (
    process.env.MYSQL_URL &&
    !isBuildPlaceholder(process.env.MYSQL_URL) &&
    !/railway\.internal/.test(process.env.MYSQL_URL)
  ) {
    chosen = process.env.MYSQL_URL
    via = 'MYSQL_URL'
  } else if (process.env.MYSQLHOST && !/railway\.internal/.test(process.env.MYSQLHOST)) {
    chosen = fromParts(process.env.MYSQLHOST, process.env.MYSQLPORT || process.env.MYSQL_PUBLIC_PORT || '3306')
    via = 'MYSQLHOST'
  } else if (process.env.MYSQL_URL) {
    chosen = process.env.MYSQL_URL
    via = 'MYSQL_URL (fallback)'
  }

  if (!chosen || isBuildPlaceholder(chosen)) {
    throw new Error(
      'DATABASE_URL ناقص. اربط MYSQL_PUBLIC_URL من خدمة MySQL على الـ API و JWT_SECRET.',
    )
  }

  process.env.DATABASE_URL = withPool(chosen)
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`[db] connected via ${via}`)
  }
}

ensureDatabaseUrl()
