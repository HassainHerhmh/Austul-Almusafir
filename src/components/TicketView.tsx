import { useState } from 'react'
import { formatTimeAr } from './utils'
import type { Booking, Trip } from '../types'
import { useApp } from '../context/AppContext'
import { useBrand } from '../context/BrandContext'
import { tripEndpoints, tripRoutePoints } from '../utils/trip'
import { TicketShareModal } from './TicketShareModal'

type Props = {
  booking: Booking
  trip: Trip
  onClose?: () => void
}

export function TicketView({ booking, trip, onClose }: Props) {
  const { state, getTripLabel, getOffice, getDestination, getVisaType } = useApp()
  const { name } = useBrand()
  const [shareOpen, setShareOpen] = useState(false)
  const customer = state.customers.find((c) => c.id === booking.customerId)
  const ends = tripEndpoints(trip)
  const routeLine =
    tripRoutePoints(trip) || (ends.fromPoint && ends.toPoint ? `${ends.fromPoint} ← ${ends.toPoint}` : '')
  const office = getOffice(booking.officeId)
  const boardingName = getDestination(booking.boardingDestinationId)?.name
  const arrivalName = getDestination(booking.arrivalDestinationId)?.name
  const visaName = getVisaType(booking.visaTypeId)?.name

  return (
    <div>
      <div className="ticket" id="printable-ticket">
        <div className="ticket-brand">{name}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>تذكرة سفر</div>
        <div className="ticket-qr" title="QR Code" aria-hidden />
        <div className="ticket-grid">
          <div>
            <span>رقم الحجز</span>
            <strong>{booking.bookingNumber ?? '—'}</strong>
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
            <span>رقم التذكرة</span>
            <strong>{booking.ticketNumber || '—'}</strong>
          </div>
          <div>
            <span>رقم الجواز</span>
            <strong>{booking.passportNumber || '—'}</strong>
          </div>
          <div>
            <span>نوع التأشيرة</span>
            <strong>{visaName || '—'}</strong>
          </div>
          <div>
            <span>منطقة الانطلاق</span>
            <strong>{boardingName || '—'}</strong>
          </div>
          <div>
            <span>منطقة الوصول</span>
            <strong>{arrivalName || '—'}</strong>
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
              {trip.date} — {formatTimeAr(trip.departureTime)}
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
            <strong>
              {trip.tripKind === 'campaign'
                ? 'حملة'
                : `${booking.price.toLocaleString('ar-YE')} ر.س`}
            </strong>
          </div>
          <div>
            <span>الحالة</span>
            <strong>{booking.status === 'confirmed' ? 'مؤكد' : 'ملغى'}</strong>
          </div>
        </div>
      </div>
      <div className="actions no-print" style={{ justifyContent: 'center', marginTop: '1rem', gap: '0.5rem' }}>
        <button type="button" className="btn btn-primary" onClick={() => setShareOpen(true)}>
          مشاركة
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
          طباعة
        </button>
        {onClose && (
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إغلاق
          </button>
        )}
      </div>

      {shareOpen && (
        <TicketShareModal
          booking={booking}
          brandName={name}
          customerPhone={customer?.phone}
          tripLine={`الرحلة: ${getTripLabel(trip)}`}
          departureLine={`الانطلاق: ${trip.date} — ${formatTimeAr(trip.departureTime)}`}
          routeLine={routeLine ? `المسار: ${routeLine}` : ''}
          onSave={() => {
            setShareOpen(false)
            window.print()
          }}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}
