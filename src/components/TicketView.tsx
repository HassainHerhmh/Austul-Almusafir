import type { Booking, Trip } from '../types'
import { useApp } from '../context/AppContext'
import { useBrand } from '../context/BrandContext'
import { tripEndpoints, tripRoutePoints } from '../utils/trip'

type Props = {
  booking: Booking
  trip: Trip
  onClose?: () => void
}

export function TicketView({ booking, trip, onClose }: Props) {
  const { getTripLabel, getOffice, getDestination } = useApp()
  const { name } = useBrand()
  const office = getOffice(booking.officeId)
  const ends = tripEndpoints(trip)
  const boardingName = getDestination(booking.boardingDestinationId)?.name

  return (
    <div>
      <div className="ticket" id="printable-ticket">
        <div className="ticket-brand">{name}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>تذكرة سفر</div>
        <div className="ticket-qr" title="QR Code" aria-hidden />
        <div className="ticket-grid">
          <div>
            <span>رقم الحجز</span>
            <strong>{booking.id}</strong>
          </div>
          <div>
            <span>المقعد</span>
            <strong>{booking.seatNumber}</strong>
          </div>
          <div>
            <span>الراكب</span>
            <strong>{booking.passengerName}</strong>
          </div>
          <div>
            <span>رقم الجواز</span>
            <strong>{booking.passportNumber || '—'}</strong>
          </div>
          <div>
            <span>منطقة الصعود</span>
            <strong>{boardingName || '—'}</strong>
          </div>
          <div>
            <span>المكتب</span>
            <strong>{office?.name}</strong>
          </div>
          <div>
            <span>الرحلة</span>
            <strong>{getTripLabel(trip)}</strong>
          </div>
          <div>
            <span>الانطلاق</span>
            <strong>
              {trip.date} — {trip.departureTime}
            </strong>
          </div>
          <div>
            <span>خط السير</span>
            <strong>{tripRoutePoints(trip) || `${ends.fromPoint} ← ${ends.toPoint}`}</strong>
          </div>
          <div>
            <span>من</span>
            <strong>{ends.fromPoint}</strong>
          </div>
          <div>
            <span>إلى</span>
            <strong>{ends.toPoint}</strong>
          </div>
          <div>
            <span>السعر</span>
            <strong>{booking.price.toLocaleString('ar-YE')} ر.ي</strong>
          </div>
          <div>
            <span>الحالة</span>
            <strong>{booking.status === 'confirmed' ? 'مؤكد' : 'ملغى'}</strong>
          </div>
        </div>
      </div>
      <div className="actions no-print" style={{ justifyContent: 'center', marginTop: '1rem' }}>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          طباعة التذكرة
        </button>
        {onClose && (
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إغلاق
          </button>
        )}
      </div>
    </div>
  )
}
