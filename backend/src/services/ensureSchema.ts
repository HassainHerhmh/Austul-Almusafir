import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config'
import { logger } from '../utils/logger'

function hasDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return true
  const host = process.env.MYSQLHOST || process.env.MYSQL_HOST
  const user = process.env.MYSQLUSER || process.env.MYSQL_USER
  const database = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE
  return Boolean(host && user && database)
}

function shouldAutoSync() {
  const flag = process.env.DB_AUTO_SYNC?.trim()
  if (flag === '0' || flag === 'false') return false
  if (flag === '1' || flag === 'true') return true
  return config.isProduction
}

/**
 * يطابق جداول MySQL مع schema.prisma (prisma db push).
 * مفعّل افتراضياً في الإنتاج — عطّله بـ DB_AUTO_SYNC=0
 */
export function ensureDatabaseSchema(): void {
  if (!shouldAutoSync()) return
  if (!hasDatabaseUrl()) {
    logger.warn('db-sync', 'لم يُعثر على DATABASE_URL أو MYSQL* — تخطي مزامنة الجداول')
    return
  }

  const backendRoot = path.resolve(__dirname, '..', '..')
  const cliJs = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js')
  const schemaPath = path.join(backendRoot, 'prisma', 'schema.prisma')

  if (!fs.existsSync(cliJs)) {
    logger.warn('db-sync', 'ملف prisma CLI غير موجود — شغّل npm install في مجلد backend')
    return
  }
  if (!fs.existsSync(schemaPath)) {
    logger.warn('db-sync', 'schema.prisma غير موجود')
    return
  }

  const result = spawnSync(
    process.execPath,
    [
      cliJs,
      'db',
      'push',
      '--accept-data-loss',
      '--skip-generate',
      '--schema',
      schemaPath,
    ],
    {
      cwd: backendRoot,
      env: process.env,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  if (result.error) {
    logger.error('db-sync', result.error.message)
    return
  }

  if (result.status === 0) {
    logger.info('db-sync', 'تمت مزامنة الجداول مع schema.prisma')
    return
  }

  const out = `${result.stderr || ''}\n${result.stdout || ''}`.trim()
  logger.error('db-sync', out || `prisma db push exited ${String(result.status)}`)

  const strict = process.env.DB_AUTO_SYNC_STRICT === '1'
  if (strict) {
    throw new Error('فشل مزامنة قاعدة البيانات — راجع السجلات')
  }
  logger.warn(
    'db-sync',
    'تشغيل API بدون مزامنة كاملة — نفّذ npm run db:sync يدوياً أو اضبط الجداول',
  )
}