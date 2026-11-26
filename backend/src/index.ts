import 'dotenv/config'
import { createApp } from './app'
import { config, prisma } from './config'
import { ensureBookingNumbers } from './services/bookingNumber'
import { ensureTripNumbers } from './services/tripNumber'
import { ensureDatabaseSchema } from './services/ensureSchema'
import { ensureBranchColumnsRaw } from './services/ensureSchemaColumns'
import { ensurePrismaConnected } from './services/dbBootstrap'
import { logger } from './utils/logger'

async function migrateLegacyBookableTrips() {
  const key = 'migrated_scheduled_to_open_v1'
  const done = await prisma.appSetting.findUnique({ where: { key } })
  if (done) return
  const result = await prisma.trip.updateMany({
    where: { status: 'scheduled' },
    data: { status: 'open' },
  })
  await prisma.appSetting.create({
    data: { key, value: { at: new Date().toISOString(), count: result.count } },
  })
  if (result.count > 0 && !config.isProduction) {
    logger.info(`migrated ${result.count} trips to open`)
  }
}

const app = createApp()

async function bootstrap() {
  ensureDatabaseSchema()
  const dbOk = await ensurePrismaConnected()
  if (dbOk) {
    try {
      await ensureBranchColumnsRaw()
    } catch (err) {
      logger.error('db-columns', err)
    }
    try {
      await migrateLegacyBookableTrips()
      await ensureBookingNumbers()
      await ensureTripNumbers()
    } catch (err) {
      logger.error('migration', err)
    }
  } else {
    logger.warn('db-bootstrap', 'API يعمل بدون قاعدة بيانات حتى يُصلح الاتصال')
  }
  app.listen(config.port, '0.0.0.0', () => {
    if (config.isProduction) logger.info('API ready')
    else logger.info(`API listening on port ${config.port}`)
  })
}

void bootstrap()
