import { Router } from 'express'
import { logger } from '../utils/logger'

export const whatsappRouter = Router()

/** رمز التحقق — نفس القيمة في Meta → Webhooks → تحقق من الرمز */
function verifyToken(): string {
  return (process.env.WHATSAPP_VERIFY_TOKEN ?? '').trim()
}

/** اشتراك Webhook (الخطوة 2 في ميتا) */
whatsappRouter.get('/webhook', (req, res) => {
  const mode = String(req.query['hub.mode'] ?? '')
  const token = String(req.query['hub.verify_token'] ?? '')
  const challenge = String(req.query['hub.challenge'] ?? '')
  const expected = verifyToken()

  if (!expected) {
    logger.warn('whatsapp-webhook', { msg: 'WHATSAPP_VERIFY_TOKEN غير معيّن على السيرفر' })
    return res.status(503).send('WHATSAPP_VERIFY_TOKEN not configured')
  }

  if (mode === 'subscribe' && token === expected) {
    logger.info('whatsapp-webhook', { msg: 'تحقق Webhook نجح' })
    return res.status(200).send(challenge)
  }

  logger.warn('whatsapp-webhook', { msg: 'رفض التحقق', mode, tokenMatch: token === expected })
  return res.sendStatus(403)
})

/** أحداث واتساب الواردة (رسائل، حالات تسليم) */
whatsappRouter.post('/webhook', (req, res) => {
  logger.info('whatsapp-webhook', { payload: req.body })
  res.sendStatus(200)
})