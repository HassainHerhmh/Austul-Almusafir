import 'dotenv/config'
import { logger } from './utils/logger'

/**
 * Railway: نفضّل MYSQL_PUBLIC_URL — العنوان الداخلي (.internal) قد يفشل.
 * Hostinger: DATABASE_URL مع localhost صحيح (MySQL على نفس السيرفر).
 */
export function ensureDatabaseUrl() {
  const isBuildPlaceholder = (url?: string) =>
    !!url && /mysql:\/\/build:/.test(url)

  const hasMysqlParts = () =>
    !!(process.env.MYSQLHOST || process.env.MYSQL_HOST) &&
    !!(process.env.MYSQLUSER || process.env.MYSQL_USER) &&
    !!(process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD)

  const withPool = (url: string) => {
    let normalized = url
    if (hasMysqlParts()) {
      const host = process.env.MYSQLHOST || process.env.MYSQL_HOST || ''
      if (/^localhost$/i.test(host)) {
        normalized = normalized.replace(/@localhost(:|\/)/i, '@127.0.0.1$1')
      }
    }
    const params = new URLSearchParams()
    if (!/[?&]connection_limit=/.test(normalized)) params.set('connection_limit', '5')
    // Hostinger / MySQL مشترك: SSL أو شهادة ذاتية
    if (
      !/[?&]sslaccept=/.test(normalized) &&
      (hasMysqlParts() ||
        /hstgr\.io|hostinger|mysql\.database\.azure/i.test(normalized))
    ) {
      params.set('sslaccept', 'accept_invalid_certs')
    }
    const qs = params.toString()
    if (!qs) return normalized
    return normalized.includes('?') ? `${normalized}&${qs}` : `${normalized}?${qs}`
  }

  const fromParts = (host: string, port?: string) => {
    const user = encodeURIComponent(process.env.MYSQLUSER || process.env.MYSQL_USER || 'root')
    const rawPass = process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || ''
    const pass = encodeURIComponent(rawPass)
    const db = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'railway'
    return `mysql://${user}:${pass}@${host}:${port || '3306'}/${db}`
  }

  let chosen: string | undefined
  let via = 'unknown'

  // Hostinger: متغيرات منفصلة أفضل — تتجنب كسر @ في كلمة المرور داخل DATABASE_URL
  if (hasMysqlParts()) {
    const host = (process.env.MYSQLHOST || process.env.MYSQL_HOST)!
    chosen = fromParts(host, process.env.MYSQLPORT || process.env.MYSQL_PORT || '3306')
    via = 'MYSQLHOST parts'
  } else {
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
    } else if (process.env.MYSQL_URL) {
      chosen = process.env.MYSQL_URL
      via = 'MYSQL_URL (fallback)'
    }
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
