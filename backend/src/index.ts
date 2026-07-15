import 'dotenv/config'
import { createApp } from './app'
import { config, prisma } from './config'

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
  if (result.count > 0) {
    console.log(`تم ترحيل ${result.count} رحلة من مجدولة إلى مفتوحة (مرة واحدة)`)
  }
}

const app = createApp()

void migrateLegacyBookableTrips()
  .catch((err) => console.error('ترحيل حالات الرحلات فشل:', err))
  .finally(() => {
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`أسطول المسافر API يعمل على 0.0.0.0:${config.port}`)
    })
  })
