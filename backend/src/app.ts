import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import type { CorsOptions } from 'cors'
import { config } from './config'
import { accountsRouter } from './routes/accounts'
import { authRouter } from './routes/auth'
import { bookingsRouter } from './routes/bookings'
import { customersRouter, vouchersRouter } from './routes/customers'
import { busesRouter, destinationsRouter, driversRouter, visaTypesRouter } from './routes/fleet'
import { officesRouter } from './routes/offices'
import { settingsRouter } from './routes/settings'
import { tripsRouter } from './routes/trips'
import { trackingRouter } from './routes/tracking'
import { usersRouter } from './routes/users'
import { partnerKeysRouter } from './routes/partnerKeys'
import { partnerApiRouter } from './routes/partnerApi'
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

  const corsOptions: CorsOptions = {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma'],
  }
  if (config.corsOrigins === true) {
    corsOptions.origin = true
  } else {
    const allowed = config.corsOrigins
    corsOptions.origin = (origin, callback) => {
      if (!origin || allowed.includes(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    }
  }

  app.use(cors(corsOptions))
  app.options(/.*/, cors(corsOptions))
  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ success: true })
  })

  app.use('/api/auth', authRouter)

  app.use('/api/offices', officesRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/destinations', destinationsRouter)
  app.use('/api/visa-types', visaTypesRouter)
  app.use('/api/buses', busesRouter)
  app.use('/api/drivers', driversRouter)
  app.use('/api/trips', tripsRouter)
  app.use('/api/bookings', bookingsRouter)
  app.use('/api/customers', customersRouter)
  app.use('/api/vouchers', vouchersRouter)
  app.use('/api/accounts', accountsRouter)
  app.use('/api/settings', settingsRouter)
  app.use('/api/tracking', trackingRouter)
  app.use('/api/partner-keys', partnerKeysRouter)
  app.use('/api/partner/v1', partnerApiRouter)

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
