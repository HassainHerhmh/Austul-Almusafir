import 'dotenv/config'

/**
 * على Railway غالباً يتوفر MYSQL_URL وليس DATABASE_URL.
 * Prisma يحتاج DATABASE_URL دائماً.
 */
export function ensureDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    if (process.env.MYSQL_URL) {
      process.env.DATABASE_URL = process.env.MYSQL_URL
    } else if (process.env.MYSQLHOST) {
      const user = encodeURIComponent(process.env.MYSQLUSER || 'root')
      const pass = encodeURIComponent(process.env.MYSQLPASSWORD || '')
      const host = process.env.MYSQLHOST
      const port = process.env.MYSQLPORT || '3306'
      const db = process.env.MYSQLDATABASE || 'railway'
      process.env.DATABASE_URL = `mysql://${user}:${pass}@${host}:${port}/${db}`
    }
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL غير موجود. أضفه في Railway أو استخدم MYSQL_URL من إضافة MySQL.',
    )
  }
}

ensureDatabaseUrl()
