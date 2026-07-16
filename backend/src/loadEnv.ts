import 'dotenv/config'
import { logger } from './utils/logger'

/**
 * على بعض مشاريع Railway العنوان الداخلي (.internal) لا يُستَجب —
 * نفضّل MYSQL_PUBLIC_URL للموثوقية، مع إمكانية MYSQL_PRIVATE_URL إن ضُبطت يدوياً.
 */
export function ensureDatabaseUrl() {
  const looksLocal = (url?: string) =>
    !!url && /127\.0\.0\.1|localhost|mysql:\/\/build:/.test(url)

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

  if (process.env.FORCE_PRIVATE_MYSQL === '1' && process.env.MYSQL_PRIVATE_URL) {
    chosen = process.env.MYSQL_PRIVATE_URL
    via = 'private (forced)'
  } else if (process.env.MYSQL_PUBLIC_URL && !looksLocal(process.env.MYSQL_PUBLIC_URL)) {
    chosen = process.env.MYSQL_PUBLIC_URL
    via = 'public'
  } else if (process.env.DATABASE_URL && !looksLocal(process.env.DATABASE_URL) && !/railway\.internal/.test(process.env.DATABASE_URL)) {
    chosen = process.env.DATABASE_URL
    via = 'DATABASE_URL'
  } else if (process.env.MYSQL_URL && !looksLocal(process.env.MYSQL_URL) && !/railway\.internal/.test(process.env.MYSQL_URL)) {
    chosen = process.env.MYSQL_URL
    via = 'MYSQL_URL'
  } else if (process.env.MYSQLHOST && !/railway\.internal/.test(process.env.MYSQLHOST)) {
    chosen = fromParts(process.env.MYSQLHOST, process.env.MYSQLPORT || process.env.MYSQL_PUBLIC_PORT || '3306')
    via = 'MYSQLHOST'
  } else if (process.env.MYSQL_PUBLIC_URL) {
    chosen = process.env.MYSQL_PUBLIC_URL
    via = 'public'
  } else if (process.env.DATABASE_URL && !looksLocal(process.env.DATABASE_URL)) {
    chosen = process.env.DATABASE_URL
    via = 'DATABASE_URL (may be private)'
  } else if (process.env.MYSQL_URL) {
    chosen = process.env.MYSQL_URL
    via = 'MYSQL_URL (may be private)'
  }

  if (!chosen || looksLocal(chosen)) {
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
