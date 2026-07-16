import 'dotenv/config'
import { createApp } from './app'
import { config, prisma } from './config'
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

void migrateLegacyBookableTrips()
  .catch((err) => logger.error('migration', err))
  .finally(() => {
    app.listen(config.port, '0.0.0.0', () => {
      if (config.isProduction) logger.info('API ready')
      else logger.info(`API listening on port ${config.port}`)
    })
  })
