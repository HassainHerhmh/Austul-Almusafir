import type { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { clientIp } from '../utils/clientIp'
import { fail } from '../utils/http'
import { logger } from '../utils/logger'

const isProd = process.env.NODE_ENV === 'production'

/** أنماط بوتات ومسح — حظر فوري */
const BOT_UA =
  /bot|crawl|spider|scan|scraper|curl\/|wget\/|python-requests|python-urllib|java\/|go-http|axios\/|httpclient|libwww|headless|phantom|selenium|puppeteer|playwright|nikto|sqlmap|masscan|nmap|zgrab|dirbuster|gobuster|hydra|fuzz|postmanruntime/i

type IpRecord = {
  failures: number
  windowStart: number
  bannedUntil: number
  strikes: number
}

const records = new Map<string, IpRecord>()
const BAN_MS = [30 * 60_000, 2 * 60 * 60_000, 24 * 60 * 60_000] // 30د، 2س، 24س

function getRecord(ip: string): IpRecord {
  let r = records.get(ip)
  if (!r) {
    r = { failures: 0, windowStart: Date.now(), bannedUntil: 0, strikes: 0 }
    records.set(ip, r)
  }
  return r
}

function prune() {
  const now = Date.now()
  if (records.size < 5000) return
  for (const [ip, r] of records) {
    if (r.bannedUntil < now && now - r.windowStart > 24 * 60 * 60_000) {
      records.delete(ip)
    }
  }
}

function isBot(req: Request) {
  const ua = String(req.headers['user-agent'] || '')
  if (!ua.trim()) return isProd
  return BOT_UA.test(ua)
}

export function isLoginBanned(ip: string) {
  const r = getRecord(ip)
  return r.bannedUntil > Date.now()
}

export function recordLoginFailure(ip: string) {
  prune()
  const r = getRecord(ip)
  const now = Date.now()

  if (now - r.windowStart > 15 * 60_000) {
    r.failures = 0
    r.windowStart = now
  }

  r.failures += 1

  if (r.failures >= 5) {
    const strikeIdx = Math.min(r.strikes, BAN_MS.length - 1)
    r.bannedUntil = now + BAN_MS[strikeIdx]!
    r.strikes = Math.min(r.strikes + 1, BAN_MS.length - 1)
    r.failures = 0
    logger.warn('login ban', { ip: maskIp(ip), minutes: BAN_MS[strikeIdx]! / 60_000 })
  }
}

export function clearLoginRecord(ip: string) {
  records.delete(ip)
}

function maskIp(ip: string) {
  if (!ip.includes('.')) return 'ip'
  const parts = ip.split('.')
  return `${parts[0]}.${parts[1]}.*.*`
}

/** طبقة أولى: حظر البوتات + IPs المحظورة */
export function loginShield(req: Request, res: Response, next: NextFunction) {
  const ip = clientIp(req)

  if (isLoginBanned(ip)) {
    return fail(res, 'تم حظر الوصول مؤقتاً بسبب محاولات مشبوهة — حاول لاحقاً', 429)
  }

  if (isBot(req)) {
    const r = getRecord(ip)
    r.bannedUntil = Date.now() + 24 * 60 * 60_000
    r.strikes = BAN_MS.length - 1
    logger.warn('bot blocked on login', { ip: maskIp(ip) })
    return fail(res, 'الوصول مرفوض', 403)
  }

  next()
}

/** طبقة ثانية: حد معدل الطلبات على تسجيل الدخول */
export const loginRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 8 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => clientIp(req),
  handler: (_req, res) => {
    return fail(res, 'محاولات كثيرة — انتظر دقيقة ثم حاول', 429)
  },
})

export const loginBurstLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 25 : 80,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => clientIp(req),
  handler: (_req, res) => {
    return fail(res, 'تم تجاوز حد المحاولات — حاول بعد 15 دقيقة', 429)
  },
})
