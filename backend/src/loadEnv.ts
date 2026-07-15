import 'dotenv/config'

/**
 * على Railway: MYSQL_URL / MYSQL_PUBLIC_URL لهما الأولوية على DATABASE_URL
 * (حتى لا يبقى رابط البناء المحلي mysql://...@127.0.0.1).
 */
export function ensureDatabaseUrl() {
  const looksLocal = (url?: string) =>
    !!url &&
    (/127\.0\.0\.1|localhost|mysql:\/\/build:/.test(url) || url.includes('@build:'))

  if (process.env.MYSQL_URL) {
    process.env.DATABASE_URL = process.env.MYSQL_URL
  } else if (process.env.MYSQL_PUBLIC_URL) {
    process.env.DATABASE_URL = process.env.MYSQL_PUBLIC_URL
  } else if (!process.env.DATABASE_URL || looksLocal(process.env.DATABASE_URL)) {
    if (process.env.MYSQLHOST) {
      const user = encodeURIComponent(process.env.MYSQLUSER || 'root')
      const pass = encodeURIComponent(process.env.MYSQLPASSWORD || '')
      const host = process.env.MYSQLHOST
      const port = process.env.MYSQLPORT || '3306'
      const db = process.env.MYSQLDATABASE || 'railway'
      process.env.DATABASE_URL = `mysql://${user}:${pass}@${host}:${port}/${db}`
    }
  }

  if (!process.env.DATABASE_URL || looksLocal(process.env.DATABASE_URL)) {
    throw new Error(
      'DATABASE_URL غير صحيح. على Railway: اربط MySQL بالخدمة وأضف متغير MYSQL_URL (Variable reference).',
    )
  }
}

ensureDatabaseUrl()
