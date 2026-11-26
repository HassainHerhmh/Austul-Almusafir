import { useEffect, useState } from 'react'
import { serverApi } from '../api/serverApi'
import type { Booking } from '../types'
import { formatTlbUploadError } from '../utils/tlbUploadError'

type Props = {
  booking: Booking
  onSuccess?: () => void
  className?: string
}

export function TlbConfirmUploadButton({ booking, onSuccess, className = 'btn btn-amber btn-sm' }: Props) {
  const [configured, setConfigured] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void serverApi.tlbApiKeys
      .active()
      .then((r) => {
        const on = r.configured && r.key?.permissions?.passengerSend !== false
        setConfigured(!!on)
      })
      .catch(() => setConfigured(false))
  }, [])

  if (!configured) return null
  if (booking.status !== 'confirmed') return null

  const sent = booking.tlbSyncStatus === 'sent'
  if (sent) {
    return (
      <span className="badge badge-ok" title={booking.tlbSyncAt?.slice(0, 16) ?? ''}>
        مُرفَع للهيئة
      </span>
    )
  }

  const failed = booking.tlbSyncStatus === 'failed'
  const failTitle = booking.tlbSyncError?.trim() || undefined

  const submit = async () => {
    const msg = failed
      ? 'إعادة إرسال التذكرة للهيئة؟'
      : `تأكيد رفع تذكرة «${booking.passengerName}» (مقعد ${booking.seatNumber}) للهيئة؟`
    if (!confirm(msg)) return
    setBusy(true)
    try {
      await serverApi.bookings.sendTlb(booking.id)
      alert('تم رفع التذكرة للهيئة بنجاح')
      onSuccess?.()
    } catch (e) {
      alert(formatTlbUploadError(e))
      onSuccess?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      title={failed ? failTitle : undefined}
      onClick={() => void submit()}
    >
      {busy ? 'جاري الرفع…' : failed ? 'إعادة تأكيد الرفع' : 'تأكيد الرفع'}
    </button>
  )
}