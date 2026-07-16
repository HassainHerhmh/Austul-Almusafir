import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { config } from './config'
import { accountsRouter } from './routes/accounts'
import { authRouter } from './routes/auth'
import { bookingsRouter } from './routes/bookings'
import { customersRouter, vouchersRouter } from './routes/customers'
import { busesRouter, destinationsRouter, driversRouter } from './routes/fleet'
import { officesRouter } from './routes/offices'
import { settingsRouter } from './routes/settings'
import { tripsRouter } from './routes/trips'
import { usersRouter } from './routes/users'
import { logger } from './utils/logger'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  )

  app.disable('x-powered-by')

  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ success: true })
  })

  app.use('/api/auth', authRouter)

  app.use('/api/offices', officesRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/destinations', destinationsRouter)
  app.use('/api/buses', busesRouter)
  app.use('/api/drivers', driversRouter)
  app.use('/api/trips', tripsRouter)
  app.use('/api/bookings', bookingsRouter)
  app.use('/api/customers', customersRouter)
  app.use('/api/vouchers', vouchersRouter)
  app.use('/api/accounts', accountsRouter)
  app.use('/api/settings', settingsRouter)

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      logger.error('api', err)
      res.status(500).json({
        success: false,
        message: logger.publicMessage(err),
      })
    },
  )

  return app
}
