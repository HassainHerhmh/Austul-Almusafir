import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TripOfferCard } from '../../components/TripOfferCard'
import { formatMoney, todayStr } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import type { TripStatus } from '../../types'

function statusBadge(s: TripStatus) {
  if (s === 'scheduled') return <span className="badge badge-info">ظ…ط¬ط¯ظˆظ„ط©</span>
  if (s === 'open') return <span className="badge badge-ok">ظ…ظپطھظˆط­ط©</span>
  if (s === 'closed') return <span className="badge badge-warn">ظ…ظ‚ظپظ„ط©</span>
  if (s === 'cancelled') return <span className="badge badge-danger">ظ…ظ„ط؛ط§ط©</span>
  if (s === 'departed') return <span className="badge badge-info">ط§ظ†ط·ظ„ظ‚طھ</span>
  return <span className="badge badge-warn">ظ…ظƒطھظ…ظ„ط©</span>
}

export function OfficeHome() {
  const {
    currentOffice,
    state,
    getTripLabel,
    getTripSeats,
    getBus,
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
      // ظ…ظ‚ظپظ„ط© / ظ…ظ„ط؛ط§ط© / ظ…ط¬ط¯ظˆظ„ط© ظ„ط§ طھط¸ظ‡ط± ظ„ظ„ظˆظƒظٹظ„
      if (t.status === 'closed' || t.status === 'cancelled' || t.status === 'scheduled') {
        return false
      }
      // ظ…ظƒطھظ…ظ„ط© / ط§ظ†ط·ظ„ظ‚طھ: طھط¸ظ‡ط± ظپظ‚ط· ط¥ط°ط§ ظ„ط¯ظ‰ ظ‡ط°ط§ ط§ظ„ظ…ظƒطھط¨ ط­ط¬ظˆط²ط§طھ ط¹ظ„ظ‰ ظ†ظپط³ ط§ظ„ط±ط­ظ„ط©
      if (t.status === 'completed' || t.status === 'departed') {
        return officeBookedCount > 0
      }
      // ط­ظ…ظ„ط© ظ…ظپطھظˆط­ط©: طھط¸ظ‡ط± ظ„ظ…ظƒطھط¨ ط§ظ„ط­ظ…ظ„ط© ط¯ظˆظ† ط§ط´طھط±ط§ط· طھط§ط±ظٹط® ط§ظ„ظٹظˆظ…
      if (t.tripKind === 'campaign') {
        if (t.status !== 'open') return false
        return !t.campaignOfficeId || t.campaignOfficeId === officeId
      }
      // ط±ظƒط§ط¨: ط§ظ„ظ…ظپطھظˆط­ط© ظپظ‚ط· طھط¸ظ‡ط± ط¯ط§ط¦ظ…ط§ظ‹
      return t.status === 'open'
    })
    .sort((a, b) => {
      // ط§ظ„ظ…ظپطھظˆط­ط© ط£ظˆظ„ط§ظ‹طŒ ط«ظ… ط§ظ„ط£ط­ط¯ط« طھط§ط±ظٹط®ط§ظ‹
      if (a.status === 'open' && b.status !== 'open') return -1
      if (b.status === 'open' && a.status !== 'open') return 1
      return b.date.localeCompare(a.date) || b.departureTime.localeCompare(a.departureTime)
    })

  useEffect(() => {
    // ظ†ط­طھط§ط¬ ظ„ظ…ط¹ط±ظپط© ط§ظ„ظ…ظ‚ط§ط¹ط¯ ط§ظ„ظ…ط­ط¬ظˆط²ط© ط¹ط¨ط± ط¬ظ…ظٹط¹ ط§ظ„ظˆظƒظ„ط§ط، ظ„ط¹ط±ط¶ آ«ظ…طھط¨ظ‚ظٹآ» ط¨ط¯ظ‚ط©
    // ظ†ظڈط­ظ…ظ‘ظ„ ط£ظˆظ„ ط¹ط¯ط© ط±ط­ظ„ط§طھ ظپظ‚ط· ظ„طھط®ظپظٹظپ ط§ظ„ط¶ط؛ط· ط¹ظ„ظ‰ ط§ظ„ط³ظٹط±ظپط±.
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
            ط­ط¬ط² ط¬ط¯ظٹط¯
          </Link>
        )}
      </header>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">ط­ط¬ظˆط²ط§طھ ط§ظ„ظ…ظƒطھط¨</div>
          <div className="stat-value">{myBookings.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">ظ…ط¨ظٹط¹ط§طھ ط§ظ„ظٹظˆظ…</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(todaySales)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">ط§ظ„ط¹ظ…ظ„ط§ط،</div>
          <div className="stat-value">{myCustomers.length}</div>
        </div>
        {can('view_accounts') && (
          <div className="stat">
            <div className="stat-label">ط±طµظٹط¯ ط§ظ„طµظ†ط¯ظˆظ‚</div>
            <div className="stat-value" style={{ fontSize: '1.15rem' }}>
              {formatMoney(cash)}
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>ط¬ظ…ظٹط¹ ط§ظ„ط±ط­ظ„ط§طھ (ظ…ظ‚ط§ط¹ط¯ ظ…ط±ظƒط²ظٹط© ظ…ط´طھط±ظƒط©)</h2>
        </div>
        <div className="trip-card-list">
          {trips.map((trip) => {
            const seats = getTripSeats(trip.id)
            const officeBookedCount = myBookingsByTrip[trip.id] ?? 0
            const isToday = trip.date === today
            const canBook = trip.status === 'open' && seats.remaining > 0
            const bus = getBus(trip.busId)
            return (
              <TripOfferCard
                key={trip.id}
                trip={trip}
                title={getTripLabel(trip)}
                busType={bus?.type}
                seats={seats}
                badges={
                  <>
                    {trip.tripKind === 'campaign' && (
                      <span className="badge badge-warn">ط­ظ…ظ„ط©</span>
                    )}
                    {isToday && <span className="badge badge-amber badge-warn">ط§ظ„ظٹظˆظ…</span>}
                    {statusBadge(trip.status)}
                    <span className="badge badge-danger">ط­ط¬ظˆط²ط§طھظƒ {officeBookedCount}</span>
                  </>
                }
                action={
                  can('book') && canBook ? (
                    <Link to={`/office/bookings?trip=${trip.id}`} className="btn btn-primary">
                      ط§ط®طھظٹط§ط±
                    </Link>
                  ) : null
                }
              />
            )
          })}
          {trips.length === 0 && <div className="empty">ظ„ط§ طھظˆط¬ط¯ ط±ط­ظ„ط§طھ</div>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>ط¢ط®ط± ط­ط¬ظˆط²ط§طھ ظ…ظƒطھط¨ظƒ</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>ط§ظ„ط±ط§ظƒط¨</th>
                <th>ط§ظ„ط±ط­ظ„ط©</th>
                <th>ط§ظ„ظ…ظ‚ط¹ط¯</th>
                <th>ط§ظ„ط³ط¹ط±</th>
              </tr>
            </thead>
            <tbody>
              {myBookings.slice(0, 8).map((b) => {
                const trip = state.trips.find((t) => t.id === b.tripId)
                return (
                  <tr key={b.id}>
                    <td>{b.passengerName}</td>
                    <td>{trip ? getTripLabel(trip) : 'â€”'}</td>
                    <td>{b.seatNumber}</td>
                    <td>{trip?.tripKind === 'campaign' ? 'ط­ظ…ظ„ط©' : formatMoney(b.price)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {myBookings.length === 0 && <div className="empty">ظ„ط§ ط­ط¬ظˆط²ط§طھ ط¨ط¹ط¯</div>}
        </div>
      </div>
    </div>
  )
}
