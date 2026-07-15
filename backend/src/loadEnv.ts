import 'dotenv/config'

/**
 * ترتيب الاتصال بقاعدة البيانات على Railway:
 * 1) الشبكة الداخلية (أسرع) — MYSQL_PRIVATE_URL أو host فيه .railway.internal
 * 2) الرابط العام MYSQL_PUBLIC_URL كاحتياط
 */
export function ensureDatabaseUrl() {
  const looksLocal = (url?: string) =>
    !!url && /127\.0\.0\.1|localhost|mysql:\/\/build:/.test(url)

  const looksPrivate = (url?: string) => !!url && /railway\.internal/.test(url)

  const fromParts = (host: string, port?: string) => {
    const user = encodeURIComponent(process.env.MYSQLUSER || 'root')
    const pass = encodeURIComponent(process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || '')
    const db = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'railway'
    return `mysql://${user}:${pass}@${host}:${port || '3306'}/${db}`
  }

  let chosen: string | undefined

  if (process.env.MYSQL_PRIVATE_URL && !looksLocal(process.env.MYSQL_PRIVATE_URL)) {
    chosen = process.env.MYSQL_PRIVATE_URL
  } else if (looksPrivate(process.env.DATABASE_URL)) {
    chosen = process.env.DATABASE_URL
  } else if (looksPrivate(process.env.MYSQL_URL)) {
    chosen = process.env.MYSQL_URL
  } else if (process.env.MYSQLHOST && /railway\.internal/.test(process.env.MYSQLHOST)) {
    chosen = fromParts(process.env.MYSQLHOST, process.env.MYSQLPORT || '3306')
  } else if (process.env.MYSQL_PUBLIC_URL && !looksLocal(process.env.MYSQL_PUBLIC_URL)) {
    chosen = process.env.MYSQL_PUBLIC_URL
  } else if (process.env.DATABASE_URL && !looksLocal(process.env.DATABASE_URL)) {
    chosen = process.env.DATABASE_URL
  } else if (process.env.MYSQL_URL && !looksLocal(process.env.MYSQL_URL)) {
    chosen = process.env.MYSQL_URL
  } else if (process.env.MYSQLHOST) {
    chosen = fromParts(process.env.MYSQLHOST, process.env.MYSQLPORT || '3306')
  }

  if (!chosen || looksLocal(chosen)) {
    throw new Error(
      'DATABASE_URL ناقص. على خدمة الـ API اربط MySQL عبر Variable Reference و JWT_SECRET.',
    )
  }

  // تجنّب فتح اتصالات كثيرة على خطط Railway الصغيرة
  if (!/[?&]connection_limit=/.test(chosen)) {
    chosen += chosen.includes('?') ? '&connection_limit=5' : '?connection_limit=5'
  }

  process.env.DATABASE_URL = chosen
  const via = looksPrivate(chosen) ? 'private' : 'public'
  console.log(`[db] using ${via} MySQL URL`)
}

ensureDatabaseUrl()
