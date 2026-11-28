import type { Booking } from '../types'
import {
  buildTicketWhatsAppMessage,
  buildWhatsAppTicketUrl,
  phoneDigitsForWhatsApp,
  resolveBookingCustomerPhone,
} from '../utils/whatsapp'

type Props = {
  booking: Booking
  brandName: string
  customerPhone?: string
  tripLine: string
  departureLine: string
  routeLine: string
  onSave: () => void
  onClose: () => void
}

export function TicketShareModal({
  booking,
  brandName,
  customerPhone,
  tripLine,
  departureLine,
  routeLine,
  onSave,
  onClose,
}: Props) {
  const rawPhone = resolveBookingCustomerPhone(booking, customerPhone)
  const waDigits = phoneDigitsForWhatsApp(rawPhone)
  const canWhatsApp = Boolean(waDigits)

  const openWhatsApp = () => {
    if (!waDigits) return
    const text = buildTicketWhatsAppMessage({
      brandName,
      booking,
      tripLine,
      departureLine,
      routeLine,
    })
    const url = buildWhatsAppTicketUrl(waDigits, text)
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal ticket-share-modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>مشاركة التذكرة</h2>
        <p className="muted" style={{ marginBottom: '1rem' }}>
          اختر حفظ نسخة من التذكرة أو إرسال ملخص للعميل عبر واتساب.
        </p>
        <div className="field">
          <label>رقم العميل (من الحجز)</label>
          <input readOnly dir="ltr" value={rawPhone || '— غير مسجل —'} />
          {!canWhatsApp && rawPhone && (
            <p className="field-hint" style={{ color: 'var(--danger, #c62828)' }}>
              الرقم غير صالح لواتساب — صحّح حقل الهاتف (MobileTranslt) في الحجز.
            </p>
          )}
          {!rawPhone && (
            <p className="field-hint" style={{ color: 'var(--danger, #c62828)' }}>
              أضف رقم الهاتف عند الحجز ليتاح الإرسال عبر واتساب.
            </p>
          )}
        </div>
        <div className="actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <button type="button" className="btn btn-primary" onClick={onSave}>
            حفظ التذكرة (طباعة / PDF)
          </button>
          <button
            type="button"
            className="btn"
            style={{
              background: canWhatsApp ? '#25D366' : undefined,
              color: canWhatsApp ? '#fff' : undefined,
              borderColor: canWhatsApp ? '#25D366' : undefined,
            }}
            disabled={!canWhatsApp}
            title={canWhatsApp ? 'يفتح واتساب مع نص التذكرة' : 'يلزم رقم صالح'}
            onClick={openWhatsApp}
          >
            إرسال عبر واتساب
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
        </div>
        <p className="field-hint" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
          الخطوة التالية (API ميتا): إرسال تلقائي من رقم الشركة دون فتح واتساب — يتطلب رمز
          الوصول وليس Webhook فقط.
        </p>
      </div>
    </div>
  )
}