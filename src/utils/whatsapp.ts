import type { Booking } from '../types'

/** رقم الجوال من حقل العميل/المسافر */
export function resolveBookingCustomerPhone(
  booking: Booking,
  customerPhone?: string,
): string {
  return (booking.MobileTranslt ?? '').trim() || (customerPhone ?? '').trim()
}

/** تنسيق رقم اليمن لرابط wa.me (بدون +) */
export function phoneDigitsForWhatsApp(raw: string): string | null {
  let d = raw.replace(/[\s\-()]/g, '').replace(/^\+/, '')
  if (!d) return null
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0')) d = `967${d.slice(1)}`
  else if (d.length <= 9 && /^7/.test(d)) d = `967${d}`
  else if (!d.startsWith('967') && d.length >= 8 && d.length <= 9) d = `967${d}`
  if (!/^\d{10,15}$/.test(d)) return null
  return d
}

export function buildWhatsAppTicketUrl(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`
}

export function buildTicketWhatsAppMessage(input: {
  brandName: string
  booking: Booking
  tripLine: string
  departureLine: string
  routeLine: string
}): string {
  const { brandName, booking, tripLine, departureLine, routeLine } = input
  const lines = [
    `🎫 *${brandName}* — تذكرة سفر`,
    '',
    `الراكب: ${booking.passengerName}`,
    `رقم التذكرة: ${booking.ticketNumber || '—'}`,
    `رقم الحجز: ${booking.bookingNumber ?? '—'}`,
    `المقعد: ${booking.seatNumber}`,
    tripLine,
    departureLine,
    routeLine,
    `السعر: ${booking.price.toLocaleString('ar-YE')} ر.س`,
    '',
    'يرجى الاحتفاظ بالتذكرة عند السفر.',
  ]
  return lines.filter((l) => l !== undefined).join('\n')
}