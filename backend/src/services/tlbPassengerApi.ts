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

function defaultBaseUrl() {
  return 'https://apicomny-001-site1.htempurl.com/'
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
  companyId: string
  visaTypeName: string
  arrivalPlace: string
}) {
  const { booking, tripId, companyId, visaTypeName, arrivalPlace } = input
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
    IDLocalex: tripId,
    IDTiktex: booking.ticketNumber.trim(),
    Ticketamountex: booking.price,
    CompanyId: companyId,
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
  },
  jsonBody: string,
) {
  const url = new URL('api/passenger', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json; charset=utf-8',
  }

  if (config.useHmacSignature) {
    const body = Buffer.from(jsonBody, 'utf8')
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonceBytes = crypto.randomBytes(32)
    const nonce = toHex(nonceBytes)
    const bodyHash = toHex(crypto.createHash('sha256').update(body).digest())
    const canonical = `POST\n/api/passenger\n${timestamp}\n${nonce}\n${bodyHash}`
    const signature = crypto
      .createHmac('sha256', Buffer.from(config.apiSecret, 'utf8'))
      .update(canonical, 'utf8')
      .digest('base64')
    headers['X-Company-Code'] = config.companyId
    headers['X-Api-Key'] = config.apiKey
    headers['X-Timestamp'] = timestamp
    headers['X-Nonce'] = nonce
    headers['X-Signature'] = signature
  } else {
    headers['X-API-KEY'] = config.apiKey
  }

  const res = await fetch(url, { method: 'POST', headers, body: jsonBody })
  const responseBody = await res.text()
  return { statusCode: res.status, responseBody, ok: res.ok }
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
    companyId: keyRow.companyId,
    visaTypeName,
    arrivalPlace,
  })

  const jsonBody = JSON.stringify(payload)
  const baseUrl = (keyRow.apiBaseUrl || defaultBaseUrl()).trim() || defaultBaseUrl()

  try {
    const result = await postPassenger(
      baseUrl,
      {
        companyId: keyRow.companyId,
        apiKey: keyRow.apiKey,
        apiSecret: keyRow.apiSecret,
        useHmacSignature: keyRow.permissions.useHmacSignature,
      },
      jsonBody,
    )

    await prisma.tlbPassengerLog.create({
      data: {
        bookingId: booking.id,
        success: result.ok,
        statusCode: result.statusCode,
        requestJson: jsonBody,
        responseBody: result.responseBody.slice(0, 8000),
        errorMessage: result.ok ? '' : `HTTP ${result.statusCode}`,
      },
    })

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        tlbSyncStatus: result.ok ? 'sent' : 'failed',
        tlbSyncAt: new Date(),
        tlbSyncError: result.ok ? '' : result.responseBody.slice(0, 500),
      },
    })

    return {
      skipped: false as const,
      ok: result.ok,
      statusCode: result.statusCode,
      responseBody: result.responseBody,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('tlb-passenger', { bookingId, msg })
    await prisma.tlbPassengerLog.create({
      data: {
        bookingId: booking.id,
        success: false,
        statusCode: null,
        requestJson: jsonBody,
        responseBody: '',
        errorMessage: msg.slice(0, 500),
      },
    })
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        tlbSyncStatus: 'failed',
        tlbSyncAt: new Date(),
        tlbSyncError: msg.slice(0, 500),
      },
    })
    return { skipped: false as const, ok: false, error: msg }
  }
}

export async function tryAutoSendTlbPassenger(bookingId: string) {
  const keyRow = await getActiveTlbApiKey()
  if (!keyRow?.permissions.autoOnBooking) return
  void sendTlbPassengerForBooking(bookingId).catch((err) =>
    logger.error('tlb-passenger-auto', err),
  )
}