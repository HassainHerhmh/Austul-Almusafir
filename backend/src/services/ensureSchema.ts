import { spawnSync } from 'node:child_process'
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
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const result = spawnSync(
    npx,
    ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate'],
    {
      cwd: backendRoot,
      env: process.env,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  if (result.status === 0) {
    logger.info('db-sync', 'تمت مزامنة الجداول مع schema.prisma')
    return
  }

  const err = `${result.stderr || ''}\n${result.stdout || ''}`.trim()
  logger.error('db-sync', err || `prisma db push exited ${result.status}`)
  if (config.isProduction) {
    throw new Error('فشل مزامنة قاعدة البيانات — راجع السجلات أو نفّذ npx prisma db push يدوياً')
  }
}