import 'dotenv/config'
import { createApp } from './app'
import { config, prisma } from './config'
import { ensureBookingNumbers } from './services/bookingNumber'
import { ensureDatabaseSchema } from './services/ensureSchema'
import { ensureBranchColumnsRaw } from './services/ensureSchemaColumns'
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
  try {
    await ensureBranchColumnsRaw()
  } catch (err) {
    logger.error('db-columns', err)
  }
  try {
    await migrateLegacyBookableTrips()
    await ensureBookingNumbers()
  } catch (err) {
    logger.error('migration', err)
  }
  app.listen(config.port, '0.0.0.0', () => {
    if (config.isProduction) logger.info('API ready')
    else logger.info(`API listening on port ${config.port}`)
  })
}

void bootstrap()
