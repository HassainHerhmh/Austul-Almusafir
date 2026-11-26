import { Baby, User } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import type { Trip } from '../types'
import { useApp } from '../context/AppContext'
import { formatDateAr, formatMoney, formatTimeAr } from './utils'
import { busTypeLabel } from '../utils/busDisplay'
import { tripNumberLabel, tripRoutePoints } from '../utils/trip'

type SeatInfo = { remaining: number; booked: number; total: number }

type Props = {
  trip: Trip
  title: string
  busType?: string
  seats?: SeatInfo
  badges?: ReactNode
  action?: ReactNode
  footer?: ReactNode
}

export function TripOfferCard({ trip, title, busType, seats, badges, action, footer }: Props) {
  const { getDestination } = useApp()
  const cityNames = useMemo(() => {
    const seen = new Set<string>()
    const names: string[] = []
    for (const s of trip.stops ?? []) {
      if (!s.destinationId || seen.has(s.destinationId)) continue
      seen.add(s.destinationId)
      const name = getDestination(s.destinationId)?.name?.trim()
      if (name) names.push(name)
    }
    return names
  }, [trip.stops, getDestination])

  const fromCity = cityNames[0] ?? title.split(' ← ')[0]?.trim() ?? '—'
  const toCity = cityNames.length > 1 ? cityNames[cityNames.length - 1] : title.split(' ← ').pop()?.trim() ?? '—'
  const boardingPoints = tripRoutePoints(trip)

  const isCampaign = trip.tripKind === 'campaign'
  const childPrice =
    !isCampaign && trip.childPrice != null && trip.childPrice >= 0 ? trip.childPrice : trip.price
  const tripNum = tripNumberLabel(trip)

  const adultLabel = isCampaign
    ? 'حملة'
    : trip.pricingMode === 'boarding'
      ? 'حسب الصعود'
      : formatMoney(trip.price)

  return (
    <article className="trip-offer-card">
      <header className="trip-offer-head">
        <div>
          {tripNum ? (
            <span className="badge badge-info" style={{ marginBottom: '0.35rem' }}>
              رقم الرحلة {tripNum}
            </span>
          ) : null}
          <h3 className="trip-offer-title">{title}</h3>
        </div>
        {badges ? <div className="trip-offer-badges">{badges}</div> : null}
      </header>

      <div className="trip-offer-body">
        <div className="trip-offer-route">
          <div aria-hidden className="trip-offer-timeline">
            <span className="trip-offer-dot" />
            <span className="trip-offer-line" />
            <span className="trip-offer-dot" />
          </div>
          <div className="trip-offer-stops">
            <span>{fromCity}</span>
            <span>{toCity}</span>
          </div>
          {boardingPoints ? (
            <p className="trip-offer-route-detail">نقاط الركوب: {boardingPoints}</p>
          ) : null}
        </div>

        <div className="trip-offer-schedule">
          <div className="trip-offer-time-row">
            <span className="trip-offer-time-label">وقت الحضور</span>
            <strong className="trip-offer-time-value">
              {formatTimeAr(trip.checkInTime || trip.departureTime)}
            </strong>
          </div>
          <p className="trip-offer-date">{formatDateAr(trip.date)}</p>
          <div className="trip-offer-time-row">
            <span className="trip-offer-time-label">وقت الانطلاق</span>
            <strong className="trip-offer-time-value accent">
              {formatTimeAr(trip.departureTime)}
            </strong>
          </div>
          {seats ? (
            <p className="trip-offer-seats">
              المقاعد المتبقية <strong>{seats.remaining}</strong>
              <span className="trip-offer-seats-sub">
                {' '}
                (محجوز {seats.booked} / {seats.total})
              </span>
            </p>
          ) : null}
          <span className="trip-offer-bus badge badge-info">{busTypeLabel(busType)}</span>
        </div>

        <div className="trip-offer-pricing">
          {!isCampaign ? (
            <>
              <div className="trip-offer-price-row">
                <User className="trip-offer-price-icon" size={20} strokeWidth={1.75} aria-hidden />
                <span>بالغ</span>
                <strong>{adultLabel}</strong>
              </div>
              <div className="trip-offer-price-row child">
                <Baby className="trip-offer-price-icon" size={20} strokeWidth={1.75} aria-hidden />
                <span>طفل</span>
                <strong>{formatMoney(childPrice)}</strong>
              </div>
            </>
          ) : (
            <div className="trip-offer-price-row">
              <strong>{adultLabel}</strong>
            </div>
          )}
          {action ? <div className="trip-offer-action">{action}</div> : null}
        </div>
      </div>

      {footer ? <footer className="trip-offer-foot">{footer}</footer> : null}
    </article>
  )
}