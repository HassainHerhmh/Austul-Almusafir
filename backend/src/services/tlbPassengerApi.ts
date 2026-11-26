import crypto from 'crypto'
import { prisma } from '../config'
import { logger } from '../utils/logger'

export type TlbPermissions = {
  passengerSend: boolean
  autoOnBooking: boolean
  useHmacSignature: boolean
}

export const DEFAULT_TLB_PERMISSIONS: TlbPermissions = {
  passengerSend: true,
  autoOnBooking: false,
  useHmacSignature: true,
}

export function normalizeTlbPermissions(raw: unknown): TlbPermissions {
  const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    passengerSend: p.passengerSend !== false,
    autoOnBooking: p.autoOnBooking !== false,
    useHmacSignature: p.useHmacSignature !== false,
  }
}

function toHex(bytes: Buffer) {
  return bytes.toString('hex')
}

export type HmacKeyEncoding = 'utf8' | 'hex'

function hmacKeyBuffer(apiSecret: string, encoding: HmacKeyEncoding): Buffer {
  const s = normalizeTlbCredential(apiSecret)
  if (encoding === 'hex') {
    if (!/^[0-9a-fA-F]+$/.test(s) || s.length % 2 !== 0) {
      return Buffer.from(s, 'utf8')
    }
    return Buffer.from(s, 'hex')
  }
  return Buffer.from(s, 'utf8')
}

function secretCanUseHexKey(apiSecret: string) {
  const s = normalizeTlbCredential(apiSecret)
  return /^[0-9a-fA-F]+$/.test(s) && s.length >= 32 && s.length % 2 === 0
}

function responseStage(raw: string): string {
  try {
    const j = JSON.parse(raw) as { stage?: string }
    return (j.stage ?? '').trim()
  } catch {
    return ''
  }
}

/** إزالة مسافات/أسطر زائدة من نسخ الهيئة */
export function normalizeTlbCredential(value: string) {
  return value
    .replace(/\uFEFF/g, '')
    .replace(/\r/g, '')
    .replace(/\n/g, '')
    .trim()
}

/** تحقق من طول السر — hex من الهيئة غالباً 64 حرف */
export function validateTlbApiSecret(apiSecret: string): string | null {
  const s = normalizeTlbCredential(apiSecret)
  if (!s) return 'ApiSecret مطلوب'
  if (/^[0-9a-fA-F]+$/.test(s)) {
    if (s.length === 64 || s.length === 32) return null
    return `طول ApiSecret ${s.length} حرف — إذا كان hex من الهيئة يجب أن يكون 64 حرف (قد يكون لصق زائد مثل 467 في النهاية)`
  }
  return null
}

function defaultBaseUrl() {
  return 'https://apicomny-001-site1.htempurl.com/'
}

export type TlbSendDiagnostics = {
  requestUrl: string
  authMode: 'hmac' | 'api_key_header'
  companyId: string
  /** آخر 4 أحرف من المفتاح للمطابقة دون كشف السر */
  apiKeySuffix: string
  httpStatus: number | null
  /** تم الاتصال بالرابط وتلقي رد HTTP (حتى لو 401) */
  reachedAuthority: boolean
  rawResponseBody: string
  hintAr: string
  tlbApiKeyId?: number
  /** للمطابقة مع الهيئة — SHA256 لجسم JSON (hex) */
  bodySha256Hex?: string
  /** نص التوقيع المعتمد (بدون السر) */
  canonicalString?: string
  hmacKeyEncoding?: HmacKeyEncoding
  apiSecretLength?: number
}

function maskApiKeySuffix(key: string) {
  const k = key.trim()
  if (k.length <= 4) return '****'
  return `…${k.slice(-4)}`
}

/** رسالة عربية من استجابة JSON لسيرفر الهيئة */
export function formatTlbAuthorityError(raw: string): string {
  const t = raw.trim()
  if (!t) return 'رفض سيرفر الهيئة بدون تفاصيل'
  try {
    const j = JSON.parse(t) as { message?: string; stage?: string }
    const stage = (j.stage ?? '').trim()
    const message = (j.message ?? '').trim()
    if (stage === 'API_KEY_NOT_MATCHED') {
      return (
        'مفتاح API غير مطابق عند الهيئة — تحقق من CompanyId و ApiKey و ApiSecret في إعدادات PassengerApi ' +
        '(نفس القيم التي زودتكم بها الهيئة)، وأن السجل «فعال» وعنوان apiBaseUrl هو رابط الإنتاج إن وُجد.'
      )
    }
    if (stage === 'COMPANY_CODE_NOT_MATCHED' || stage === 'COMPANY_ID_NOT_MATCHED') {
      return 'كود الشركة (CompanyId) غير مطابق — يجب أن يطابق المسجل لدى الهيئة في الرأس والـ JSON.'
    }
    if (stage === 'SIGNATURE_MISMATCH') {
      return (
        'التوقيع HMAC غير مطابق — المفتاح (ApiKey) مقبول غالباً لكن ApiSecret خطأ أو مقترن بمفتاح آخر. ' +
        'أعد إدخال ApiSecret حرفياً كما في خطاب الهيئة (بدون مسافات زائدة)، واترك خيار HMAC مفعّلاً.'
      )
    }
    if (stage === 'MISSING_HEADERS') {
      return 'الهيئة تتطلب رؤوس HMAC (X-Company-Code, X-Api-Key, X-Timestamp, X-Nonce, X-Signature) — فعّل توقيع HMAC.'
    }
    if (message && stage) return `${message} (${stage})`
    if (message) return message
  } catch {
    /* ليس JSON */
  }
  return t.length > 400 ? `${t.slice(0, 400)}…` : t
}

export async function getActiveTlbApiKey() {
  const row = await prisma.tlbApiKey.findFirst({
    where: { isActive: 1 },
    orderBy: { apiId: 'desc' },
  })
  if (!row) return null
  return {
    ...row,
    permissions: normalizeTlbPermissions(row.permissions),
  }
}

function bookingPassportNumber(b: {
  NumberPaspport: string
  passportNumber: string
}) {
  return (b.NumberPaspport || b.passportNumber || '').trim()
}

export function buildTlbPassengerPayload(input: {
  booking: {
    TransltName: string
    TransltScondName: string
    TransltThreeName: string
    TransltLastName: string
    NumberPaspport: string
    passportNumber: string
    TransltNationlity: string
    numbervisa: string
    MobileTranslt: string
    SexTranslte: string
    PlaceAcess: string
    DateCard: string
    PlaceCard: string
    ticketNumber: string
    seatNumber: number
    price: number
    bookedAt: Date
    typevisa2: string
    notes: string
  }
  tripId: string
  tripNumber: number | null
  companyId: string
  visaTypeName: string
  arrivalPlace: string
}) {
  const { booking, tripId, tripNumber, companyId, visaTypeName, arrivalPlace } = input
  const idLocalex =
    tripNumber != null && tripNumber > 0 ? String(tripNumber) : tripId
  const placeAccess =
    (booking.PlaceAcess || arrivalPlace || booking.notes || '').trim()
  const daterg = booking.bookedAt.toISOString().slice(0, 10)
  return {
    TransltName: booking.TransltName.trim(),
    TransltScondName: booking.TransltScondName.trim(),
    TransltThreeName: booking.TransltThreeName.trim(),
    TransltLastName: booking.TransltLastName.trim(),
    NumberPaspport: bookingPassportNumber(booking),
    TransltNationlity: booking.TransltNationlity.trim(),
    numbervisa: booking.numbervisa.trim(),
    MobileTranslt: booking.MobileTranslt.trim(),
    SexTranslte: booking.SexTranslte.trim(),
    PlaceAcess: placeAccess,
    DateCard: booking.DateCard.trim(),
    PlaceCard: booking.PlaceCard.trim(),
    IDLocalex: idLocalex,
    IDTiktex: booking.ticketNumber.trim(),
    Ticketamountex: booking.price,
    CompanyId: companyId.trim(),
    daterg,
    typevisa2: (booking.typevisa2 || visaTypeName || '').trim(),
    NumberChck2: String(booking.seatNumber),
  }
}

export function splitPassengerName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) {
    return {
      TransltName: parts[0] ?? '',
      TransltScondName: '',
      TransltThreeName: '',
      TransltLastName: '',
    }
  }
  if (parts.length === 2) {
    return {
      TransltName: parts[0],
      TransltScondName: '',
      TransltThreeName: '',
      TransltLastName: parts[1],
    }
  }
  if (parts.length === 3) {
    return {
      TransltName: parts[0],
      TransltScondName: parts[1],
      TransltThreeName: '',
      TransltLastName: parts[2],
    }
  }
  return {
    TransltName: parts[0],
    TransltScondName: parts[1],
    TransltThreeName: parts[2],
    TransltLastName: parts.slice(3).join(' '),
  }
}

export function mergeTlbPassengerFields(body: {
  passengerName: string
  passportNumber?: string
  phone?: string
  notes?: string
  TransltName?: string
  TransltScondName?: string
  TransltThreeName?: string
  TransltLastName?: string
  NumberPaspport?: string
  TransltNationlity?: string
  numbervisa?: string
  MobileTranslt?: string
  SexTranslte?: string
  PlaceAcess?: string
  DateCard?: string
  PlaceCard?: string
  typevisa2?: string
}) {
  const split = splitPassengerName(body.passengerName)
  const passport = (body.NumberPaspport ?? body.passportNumber ?? '').trim()
  return {
    TransltName: (body.TransltName ?? split.TransltName).trim(),
    TransltScondName: (body.TransltScondName ?? split.TransltScondName).trim(),
    TransltThreeName: (body.TransltThreeName ?? split.TransltThreeName).trim(),
    TransltLastName: (body.TransltLastName ?? split.TransltLastName).trim(),
    NumberPaspport: passport,
    TransltNationlity: (body.TransltNationlity ?? '').trim(),
    numbervisa: (body.numbervisa ?? '').trim(),
    MobileTranslt: (body.MobileTranslt ?? body.phone ?? '').trim(),
    SexTranslte: (body.SexTranslte ?? '').trim(),
    PlaceAcess: (body.PlaceAcess ?? '').trim(),
    DateCard: (body.DateCard ?? '').trim(),
    PlaceCard: (body.PlaceCard ?? '').trim(),
    typevisa2: (body.typevisa2 ?? '').trim(),
  }
}

async function postPassenger(
  baseUrl: string,
  config: {
    companyId: string
    apiKey: string
    apiSecret: string
    useHmacSignature: boolean
    hmacKeyEncoding?: HmacKeyEncoding
  },
  jsonBody: string,
) {
  const url = new URL('api/passenger', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json; charset=utf-8',
  }

  const companyId = normalizeTlbCredential(config.companyId)
  const apiKey = normalizeTlbCredential(config.apiKey)
  const apiSecret = normalizeTlbCredential(config.apiSecret)

  let bodySha256Hex: string | undefined
  let canonicalString: string | undefined

  if (config.useHmacSignature) {
    const body = Buffer.from(jsonBody, 'utf8')
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonceBytes = crypto.randomBytes(32)
    const nonce = toHex(nonceBytes)
    const bodyHash = toHex(crypto.createHash('sha256').update(body).digest())
    bodySha256Hex = bodyHash
    const canonical = `POST\n/api/passenger\n${timestamp}\n${nonce}\n${bodyHash}`
    canonicalString = canonical
    const hmacKeyEncoding = config.hmacKeyEncoding ?? 'utf8'
    const signature = crypto
      .createHmac('sha256', hmacKeyBuffer(apiSecret, hmacKeyEncoding))
      .update(canonical, 'utf8')
      .digest('base64')
    headers['X-Company-Code'] = companyId
    headers['X-Api-Key'] = apiKey
    headers['X-Timestamp'] = timestamp
    headers['X-Nonce'] = nonce
    headers['X-Signature'] = signature
  } else {
    headers['X-API-KEY'] = apiKey
  }

  const requestUrl = url.toString()
  const res = await fetch(url, { method: 'POST', headers, body: jsonBody })
  const responseBody = await res.text()
  return {
    statusCode: res.status,
    responseBody,
    ok: res.ok,
    requestUrl,
    authMode: config.useHmacSignature ? ('hmac' as const) : ('api_key_header' as const),
    bodySha256Hex,
    canonicalString,
    hmacKeyEncoding: config.hmacKeyEncoding ?? 'utf8',
  }
}

export function validateTlbPassengerFields(booking: {
  TransltName: string
  TransltLastName: string
  NumberPaspport: string
  passportNumber: string
  MobileTranslt: string
  SexTranslte: string
  DateCard: string
  PlaceCard: string
}) {
  const missing: string[] = []
  if (!booking.TransltName.trim()) missing.push('الاسم الأول')
  if (!booking.TransltLastName.trim()) missing.push('اللقب')
  if (!bookingPassportNumber(booking)) missing.push('رقم الجواز')
  if (!booking.MobileTranslt.trim()) missing.push('الجوال')
  if (!booking.SexTranslte.trim()) missing.push('الجنس')
  if (!booking.DateCard.trim()) missing.push('تاريخ إصدار الجواز')
  if (!booking.PlaceCard.trim()) missing.push('مكان إصدار الجواز')
  return missing
}

export async function sendTlbPassengerForBooking(bookingId: string, opts?: { force?: boolean }) {
  const keyRow = await getActiveTlbApiKey()
  if (!keyRow) {
    return { skipped: true as const, reason: 'no_active_key' }
  }
  if (!keyRow.permissions.passengerSend) {
    return { skipped: true as const, reason: 'permission_disabled' }
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      trip: true,
    },
  })
  if (!booking || booking.status !== 'confirmed') {
    return { skipped: true as const, reason: 'booking_not_confirmed' }
  }
  if (booking.tlbSyncStatus === 'sent' && !opts?.force) {
    return { skipped: true as const, reason: 'already_sent' }
  }

  const missing = validateTlbPassengerFields(booking)
  if (missing.length) {
    return {
      skipped: false as const,
      ok: false,
      error: `بيانات الهيئة ناقصة: ${missing.join('، ')}`,
    }
  }

  let visaTypeName = booking.typevisa2
  if (!visaTypeName && booking.visaTypeId) {
    const visa = await prisma.visaType.findUnique({ where: { id: booking.visaTypeId } })
    visaTypeName = visa?.name ?? ''
  }

  let arrivalPlace = booking.PlaceAcess
  if (!arrivalPlace && booking.arrivalDestinationId) {
    const dest = await prisma.destination.findUnique({
      where: { id: booking.arrivalDestinationId },
    })
    arrivalPlace = dest?.name ?? ''
  }

  const payload = buildTlbPassengerPayload({
    booking,
    tripId: booking.tripId,
    tripNumber: booking.trip.tripNumber,
    companyId: keyRow.companyId,
    visaTypeName,
    arrivalPlace,
  })

  const jsonBody = JSON.stringify(payload)
  const baseUrl = (keyRow.apiBaseUrl || defaultBaseUrl()).trim() || defaultBaseUrl()
  const authConfig = {
    companyId: normalizeTlbCredential(keyRow.companyId),
    apiKey: normalizeTlbCredential(keyRow.apiKey),
    apiSecret: normalizeTlbCredential(keyRow.apiSecret),
    useHmacSignature: keyRow.permissions.useHmacSignature,
  }

  const buildDiagnostics = (
    partial: Pick<TlbSendDiagnostics, 'requestUrl' | 'httpStatus' | 'reachedAuthority' | 'rawResponseBody'>,
  ): TlbSendDiagnostics => ({
    requestUrl: partial.requestUrl,
    authMode: authConfig.useHmacSignature ? 'hmac' : 'api_key_header',
    companyId: authConfig.companyId,
    apiKeySuffix: maskApiKeySuffix(authConfig.apiKey),
    httpStatus: partial.httpStatus,
    reachedAuthority: partial.reachedAuthority,
    rawResponseBody: partial.rawResponseBody,
    hintAr: formatTlbAuthorityError(partial.rawResponseBody),
    tlbApiKeyId: keyRow.apiId,
  })

  try {
    let result = await postPassenger(
      baseUrl,
      { ...authConfig, hmacKeyEncoding: 'utf8' },
      jsonBody,
    )
  if (
      !result.ok &&
      responseStage(result.responseBody) === 'SIGNATURE_MISMATCH' &&
      secretCanUseHexKey(authConfig.apiSecret)
    ) {
      logger.warn('tlb-passenger', {
        bookingId,
        retry: 'hmac-key-hex',
        apiSecretLength: authConfig.apiSecret.length,
      })
      result = await postPassenger(
        baseUrl,
        { ...authConfig, hmacKeyEncoding: 'hex' },
        jsonBody,
      )
    }

    const diagnostics: TlbSendDiagnostics = {
      ...buildDiagnostics({
        requestUrl: result.requestUrl,
        httpStatus: result.statusCode,
        reachedAuthority: true,
        rawResponseBody: result.responseBody,
      }),
      bodySha256Hex: result.bodySha256Hex,
      canonicalString: result.canonicalString,
      hmacKeyEncoding: result.hmacKeyEncoding,
      apiSecretLength: authConfig.apiSecret.length,
    }

    logger.warn('tlb-passenger', {
      bookingId,
      ok: result.ok,
      requestUrl: result.requestUrl,
      httpStatus: result.statusCode,
      authMode: diagnostics.authMode,
      companyId: diagnostics.companyId,
      apiKeySuffix: diagnostics.apiKeySuffix,
      tlbApiKeyId: keyRow.apiId,
      responseBody: result.responseBody.slice(0, 2500),
    })

    await prisma.tlbPassengerLog.create({
      data: {
        bookingId: booking.id,
        success: result.ok,
        statusCode: result.statusCode,
        requestJson: jsonBody,
        responseBody: result.responseBody.slice(0, 8000),
        errorMessage: result.ok
          ? ''
          : `HTTP ${result.statusCode} | ${result.responseBody.slice(0, 450)}`,
      },
    })

    const syncError = result.ok
      ? ''
      : `${diagnostics.hintAr}\nالرابط: ${diagnostics.requestUrl}\nHTTP ${result.statusCode}\nالرد: ${result.responseBody.slice(0, 280)}`

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        tlbSyncStatus: result.ok ? 'sent' : 'failed',
        tlbSyncAt: new Date(),
        tlbSyncError: syncError.slice(0, 500),
      },
    })

    return {
      skipped: false as const,
      ok: result.ok,
      statusCode: result.statusCode,
      responseBody: result.responseBody,
      diagnostics,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const requestUrl = new URL('api/passenger', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString()
    const diagnostics = buildDiagnostics({
      requestUrl,
      httpStatus: null,
      reachedAuthority: false,
      rawResponseBody: msg,
    })

    logger.error('tlb-passenger', { bookingId, msg, requestUrl, diagnostics })
    await prisma.tlbPassengerLog.create({
      data: {
        bookingId: booking.id,
        success: false,
        statusCode: null,
        requestJson: jsonBody,
        responseBody: '',
        errorMessage: `اتصال فاشل: ${msg.slice(0, 450)}`,
      },
    })
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        tlbSyncStatus: 'failed',
        tlbSyncAt: new Date(),
        tlbSyncError: `تعذر الوصول للرابط (${requestUrl}): ${msg}`.slice(0, 500),
      },
    })
    return { skipped: false as const, ok: false, error: msg, diagnostics }
  }
}

export async function tryAutoSendTlbPassenger(bookingId: string) {
  const keyRow = await getActiveTlbApiKey()
  if (!keyRow?.permissions.autoOnBooking) return
  void sendTlbPassengerForBooking(bookingId).catch((err) =>
    logger.error('tlb-passenger-auto', err),
  )
}