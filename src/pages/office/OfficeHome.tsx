import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { formatMoney, formatTimeAr, todayStr } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import type { TripStatus } from '../../types'

function statusBadge(s: TripStatus) {
  if (s === 'scheduled') return <span className="badge badge-info">مجدولة</span>
  if (s === 'open') return <span className="badge badge-ok">مفتوحة</span>
  if (s === 'closed') return <span className="badge badge-warn">مقفلة</span>
  if (s === 'cancelled') return <span className="badge badge-danger">ملغاة</span>
  if (s === 'departed') return <span className="badge badge-info">انطلقت</span>
  return <span className="badge badge-warn">مكتملة</span>
}

export function OfficeHome() {
  const {
    currentOffice,
    state,
    getTripLabel,
    getTripSeats,
    can,
    ensureTripSeats,
  } = useApp()
  const officeId = currentOffice?.id
  const today = todayStr()

  const myBookings = state.bookings.filter(
    (b) => b.officeId === officeId && b.status === 'confirmed',
  )
  const myBookingsByTrip = myBookings.reduce<Record<string, number>>((acc, booking) => {
    acc[booking.tripId] = (acc[booking.tripId] ?? 0) + 1
    return acc
  }, {})
  const todaySales = myBookings
    .filter((b) => b.bookedAt.startsWith(today))
    .reduce((s, b) => s + b.price, 0)
  const myCustomers = state.customers.filter((c) => c.officeId === officeId)
  const vouchers = state.vouchers.filter((v) => v.officeId === officeId)
  const cash =
    vouchers.filter((v) => v.type === 'receipt').reduce((s, v) => s + v.amount, 0) -
    vouchers.filter((v) => v.type === 'payment').reduce((s, v) => s + v.amount, 0)

  const trips = [...state.trips]
    .filter((t) => {
      const officeBookedCount = myBookingsByTrip[t.id] ?? 0
      // مقفلة / ملغاة / مجدولة لا تظهر للوكيل
      if (t.status === 'closed' || t.status === 'cancelled' || t.status === 'scheduled') {
        return false
      }
      // مكتملة / انطلقت: تظهر فقط إذا لدى هذا المكتب حجوزات على نفس الرحلة
      if (t.status === 'completed' || t.status === 'departed') {
        return officeBookedCount > 0
      }
      // حملة مفتوحة: تظهر لمكتب الحملة دون اشتراط تاريخ اليوم
      if (t.tripKind === 'campaign') {
        if (t.status !== 'open') return false
        return !t.campaignOfficeId || t.campaignOfficeId === officeId
      }
      // ركاب: المفتوحة فقط تظهر دائماً
      return t.status === 'open'
    })
    .sort((a, b) => {
      // المفتوحة أولاً، ثم الأحدث تاريخاً
      if (a.status === 'open' && b.status !== 'open') return -1
      if (b.status === 'open' && a.status !== 'open') return 1
      return b.date.localeCompare(a.date) || b.departureTime.localeCompare(a.departureTime)
    })

  useEffect(() => {
    // نحتاج لمعرفة المقاعد المحجوزة عبر جميع الوكلاء لعرض «متبقي» بدقة
    // نُحمّل أول عدة رحلات فقط لتخفيف الضغط على السيرفر.
    const ids = trips.slice(0, 10).map((t) => t.id)
    void Promise.allSettled(ids.map((id) => ensureTripSeats(id)))
  }, [trips, ensureTripSeats])

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>{currentOffice?.name}</h1>
        </div>
        {can('book') && (
          <Link to="/office/bookings" className="btn btn-primary">
            حجز جديد
          </Link>
        )}
      </header>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">حجوزات المكتب</div>
          <div className="stat-value">{myBookings.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">مبيعات اليوم</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(todaySales)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">العملاء</div>
          <div className="stat-value">{myCustomers.length}</div>
        </div>
        {can('view_accounts') && (
          <div className="stat">
            <div className="stat-label">رصيد الصندوق</div>
            <div className="stat-value" style={{ fontSize: '1.15rem' }}>
              {formatMoney(cash)}
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>جميع الرحلات (مقاعد مركزية مشتركة)</h2>
        </div>
        <div className="trip-card-list">
          {trips.map((trip) => {
            const seats = getTripSeats(trip.id)
            const officeBookedCount = myBookingsByTrip[trip.id] ?? 0
            const isToday = trip.date === today
            const canBook = trip.status === 'open' && seats.remaining > 0
            return (
              <div key={trip.id} className="trip-row">
                <div>
                  <h3>
                    {getTripLabel(trip)}{' '}
                    {trip.tripKind === 'campaign' && (
                      <span className="badge badge-warn">حملة</span>
                    )}{' '}
                    {isToday && <span className="badge badge-amber badge-warn">اليوم</span>}{' '}
                    {statusBadge(trip.status)}
                  </h3>
                  <div className="trip-meta">
                    <span>{trip.date}</span>
                    <span>{formatTimeAr(trip.departureTime)}</span>
                    <span>
                      {trip.tripKind === 'campaign'
                        ? 'حملة'
                        : trip.pricingMode === 'boarding'
                          ? 'حسب الصعود'
                          : formatMoney(trip.price)}
                    </span>
                    <span>
                      {trip.stops.map((s) => s.point).filter(Boolean).join(' ← ')}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div
                    style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}
                  >
                    <div className="badge badge-danger">حجوزاتك {officeBookedCount}</div>
                    <div className="badge badge-ok">متبقي {seats.remaining}</div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
                    المحجوز الكلي {seats.booked} من {seats.total}
                  </div>
                  {can('book') && canBook && (
                    <Link
                      to={`/office/bookings?trip=${trip.id}`}
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: 8 }}
                    >
                      حجز
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
          {trips.length === 0 && <div className="empty">لا توجد رحلات</div>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>آخر حجوزات مكتبك</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الراكب</th>
                <th>الرحلة</th>
                <th>المقعد</th>
                <th>السعر</th>
              </tr>
            </thead>
            <tbody>
              {myBookings.slice(0, 8).map((b) => {
                const trip = state.trips.find((t) => t.id === b.tripId)
                return (
                  <tr key={b.id}>
                    <td>{b.passengerName}</td>
                    <td>{trip ? getTripLabel(trip) : '—'}</td>
                    <td>{b.seatNumber}</td>
                    <td>{trip?.tripKind === 'campaign' ? 'حملة' : formatMoney(b.price)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {myBookings.length === 0 && <div className="empty">لا حجوزات بعد</div>}
        </div>
      </div>
    </div>
  )
}
