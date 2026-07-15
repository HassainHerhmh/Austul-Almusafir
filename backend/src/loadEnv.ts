import 'dotenv/config'

/**
 * Railway: نفضّل MYSQL_PUBLIC_URL لأن mysql.railway.internal قد لا يُستَجب.
 */
export function ensureDatabaseUrl() {
  const looksLocal = (url?: string) =>
    !!url && /127\.0\.0\.1|localhost|mysql:\/\/build:/.test(url)

  if (process.env.MYSQL_PUBLIC_URL) {
    process.env.DATABASE_URL = process.env.MYSQL_PUBLIC_URL
  } else if (process.env.DATABASE_URL && !looksLocal(process.env.DATABASE_URL)) {
    // keep
  } else if (process.env.MYSQL_URL) {
    process.env.DATABASE_URL = process.env.MYSQL_URL
  } else if (process.env.MYSQLHOST) {
    const user = encodeURIComponent(process.env.MYSQLUSER || 'root')
    const pass = encodeURIComponent(process.env.MYSQLPASSWORD || '')
    const host = process.env.MYSQLHOST
    const port = process.env.MYSQLPORT || '3306'
    const db = process.env.MYSQLDATABASE || 'railway'
    process.env.DATABASE_URL = `mysql://${user}:${pass}@${host}:${port}/${db}`
  }

  if (!process.env.DATABASE_URL || looksLocal(process.env.DATABASE_URL)) {
    throw new Error(
      'DATABASE_URL ناقص. على خدمة الـ API أضف DATABASE_URL من MYSQL_PUBLIC_URL و JWT_SECRET.',
    )
  }
}

ensureDatabaseUrl()
