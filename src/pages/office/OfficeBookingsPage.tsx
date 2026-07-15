import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SeatMap } from '../../components/SeatMap'
import { TicketView } from '../../components/TicketView'
import { PAYMENT_LABELS, formatMoney } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import type { Booking, PaymentMethod } from '../../types'

export function OfficeBookingsPage() {
  const {
    state,
    currentUser,
    currentOffice,
    can,
    getTripLabel,
    getTripSeats,
    getDestination,
    createBooking,
    updateBooking,
  } = useApp()
  const [params] = useSearchParams()
  const officeId = currentOffice!.id

  const trips = useMemo(
    () =>
      state.trips
        .filter((t) => t.status === 'open')
        .sort((a, b) => b.date.localeCompare(a.date) || b.departureTime.localeCompare(a.departureTime)),
    [state.trips],
  )

  const [tripId, setTripId] = useState(params.get('trip') ?? trips[0]?.id ?? '')
  const [seat, setSeat] = useState<number | null>(null)
  const [passengerName, setPassengerName] = useState('')
  const [ticketNumber, setTicketNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [passportNumber, setPassportNumber] = useState('')
  const [boardingDestinationId, setBoardingDestinationId] = useState('')
  const [arrivalDestinationId, setArrivalDestinationId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ticketBooking, setTicketBooking] = useState<Booking | null>(null)
  const [changeSeatId, setChangeSeatId] = useState<string | null>(null)

  const selectedTrip = useMemo(
    () => state.trips.find((t) => t.id === tripId) ?? null,
    [state.trips, tripId],
  )

  const routeStops = useMemo(() => {
    if (!selectedTrip?.stops?.length) return []
    const seen = new Set<string>()
    return selectedTrip.stops.filter((s) => {
      if (!s.destinationId || seen.has(s.destinationId)) return false
      seen.add(s.destinationId)
      return true
    })
  }, [selectedTrip])

  const boardingStops = useMemo(() => {
    if (routeStops.length < 2) return routeStops
    return routeStops.slice(0, -1)
  }, [routeStops])

  const arrivalStops = useMemo(() => {
    if (!routeStops.length || !boardingDestinationId) return []
    const idx = routeStops.findIndex((s) => s.destinationId === boardingDestinationId)
    if (idx < 0) return routeStops.slice(1)
    return routeStops.slice(idx + 1)
  }, [routeStops, boardingDestinationId])

  useEffect(() => {
    if (!boardingStops.length) {
      setBoardingDestinationId('')
      return
    }
    if (!boardingStops.some((s) => s.destinationId === boardingDestinationId)) {
      setBoardingDestinationId(boardingStops[0].destinationId)
    }
  }, [boardingStops, boardingDestinationId])

  useEffect(() => {
    if (!arrivalStops.length) {
      setArrivalDestinationId('')
      return
    }
    if (!arrivalStops.some((s) => s.destinationId === arrivalDestinationId)) {
      setArrivalDestinationId(arrivalStops[arrivalStops.length - 1].destinationId)
    }
  }, [arrivalStops, arrivalDestinationId])

  const seats = tripId ? getTripSeats(tripId) : null

  const myBookings = state.bookings
    .filter((b) => b.officeId === officeId)
    .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!can('book')) {
      setError('ليس لديك صلاحية الحجز')
      return
    }
    if (!seat || !tripId) {
      setError('اختر الرحلة والمقعد')
      return
    }
    if (!boardingDestinationId) {
      setError('اختر منطقة الانطلاق')
      return
    }
    if (!arrivalDestinationId) {
      setError('اختر منطقة الوصول')
      return
    }
    const result = await createBooking({
      tripId,
      officeId,
      passengerName,
      ticketNumber,
      phone,
      passportNumber,
      boardingDestinationId,
      arrivalDestinationId,
      seatNumber: seat,
      paymentMethod,
      notes,
      bookedBy: currentUser!.id,
    })
    if (typeof result === 'string') {
      setError(result)
      return
    }
    setError(null)
    setPassengerName('')
    setTicketNumber('')
    setPhone('')
    setPassportNumber('')
    setNotes('')
    setSeat(null)
    setTicketBooking(result)
  }

  const handleChangeSeat = async (bookingId: string, newSeat: number) => {
    const err = await updateBooking(bookingId, { seatNumber: newSeat })
    if (err) alert(err)
    else setChangeSeatId(null)
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>الحجوزات</h1>
        </div>
      </header>

      {can('book') && (
        <div className="panel">
          <div className="panel-head">
            <h2>حجز جديد</h2>
            {seats && (
              <div className="actions">
                <span className="badge badge-info">المقاعد {seats.total}</span>
                <span className="badge badge-danger">محجوز {seats.booked}</span>
                <span className="badge badge-ok">متبقي {seats.remaining}</span>
              </div>
            )}
          </div>

          <form onSubmit={(e) => void submit(e)}>
            <div className="form-grid">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>الرحلة</label>
                <select
                  value={tripId}
                  onChange={(e) => {
                    setTripId(e.target.value)
                    setSeat(null)
                  }}
                  required
                >
                  {trips.map((t) => {
                    const s = getTripSeats(t.id)
                    return (
                      <option key={t.id} value={t.id}>
                        {getTripLabel(t)} — {t.date} {t.departureTime} (متبقي {s.remaining})
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="field">
                <label>اسم الراكب</label>
                <input
                  required
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                />
              </div>
              <div className="field">
                <label>رقم التذكرة</label>
                <input
                  required
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  placeholder="مثال: T-1001"
                />
              </div>
              <div className="field">
                <label>الهاتف</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="اختياري" />
              </div>
              <div className="field">
                <label>رقم الجواز</label>
                <input
                  required
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                  placeholder="مثال: P-1234567"
                />
              </div>
              <div className="field">
                <label>منطقة الانطلاق</label>
                <select
                  required
                  value={boardingDestinationId}
                  onChange={(e) => setBoardingDestinationId(e.target.value)}
                  disabled={!boardingStops.length}
                >
                  {!boardingStops.length && <option value="">اختر رحلة أولاً</option>}
                  {boardingStops.map((s) => (
                    <option key={s.destinationId} value={s.destinationId}>
                      {getDestination(s.destinationId)?.name ?? s.destinationId}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>منطقة الوصول</label>
                <select
                  required
                  value={arrivalDestinationId}
                  onChange={(e) => setArrivalDestinationId(e.target.value)}
                  disabled={!arrivalStops.length}
                >
                  {!arrivalStops.length && <option value="">اختر الانطلاق أولاً</option>}
                  {arrivalStops.map((s) => (
                    <option key={s.destinationId} value={s.destinationId}>
                      {getDestination(s.destinationId)?.name ?? s.destinationId}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>طريقة الدفع</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  <option value="cash">نقدي</option>
                  <option value="transfer">تحويل</option>
                  <option value="credit">آجل</option>
                </select>
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>الملاحظات</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="اختياري"
                />
              </div>
            </div>

            {seats && (
              <SeatMap
                total={seats.total}
                bookedSeats={seats.bookedSeats}
                selected={seat}
                onSelect={setSeat}
              />
            )}

            {error && <p className="error-msg">{error}</p>}
            <div className="actions" style={{ marginTop: '1rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!seat || !boardingDestinationId || !arrivalDestinationId}
              >
                تأكيد الحجز {seat ? `(مقعد ${seat})` : ''}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h2>حجوزات {currentOffice?.name}</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الراكب</th>
                <th>رقم التذكرة</th>
                <th>رقم الجواز</th>
                <th>منطقة الانطلاق</th>
                <th>منطقة الوصول</th>
                <th>الرحلة</th>
                <th>المقعد</th>
                <th>الدفع</th>
                <th>الملاحظات</th>
                <th>الحالة</th>
                <th>السعر</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {myBookings.map((b) => {
                const trip = state.trips.find((t) => t.id === b.tripId)
                return (
                  <tr key={b.id}>
                    <td>{b.passengerName}</td>
                    <td>{b.ticketNumber || '—'}</td>
                    <td>{b.passportNumber || '—'}</td>
                    <td>{getDestination(b.boardingDestinationId)?.name || '—'}</td>
                    <td>{getDestination(b.arrivalDestinationId)?.name || '—'}</td>
                    <td>{trip ? getTripLabel(trip) : '—'}</td>
                    <td>{b.seatNumber}</td>
                    <td>{PAYMENT_LABELS[b.paymentMethod]}</td>
                    <td>{b.notes?.trim() ? b.notes : '—'}</td>
                    <td>
                      <span
                        className={`badge ${b.status === 'confirmed' ? 'badge-ok' : 'badge-danger'}`}
                      >
                        {b.status === 'confirmed' ? 'مؤكد' : 'ملغى'}
                      </span>
                    </td>
                    <td>{formatMoney(b.price)}</td>
                    <td>
                      <div className="actions">
                        {can('print_ticket') && b.status === 'confirmed' && trip && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setTicketBooking(b)}
                          >
                            تذكرة
                          </button>
                        )}
                        {can('book') && b.status === 'confirmed' && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setChangeSeatId(b.id)}
                          >
                            تغيير مقعد
                          </button>
                        )}
                        {can('cancel_booking') && b.status === 'confirmed' && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              if (confirm('إلغاء الحجز؟')) void updateBooking(b.id, { status: 'cancelled' })
                            }}
                          >
                            إلغاء
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {ticketBooking && (
        <div className="modal-backdrop" onClick={() => setTicketBooking(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <TicketView
              booking={ticketBooking}
              trip={state.trips.find((t) => t.id === ticketBooking.tripId)!}
              onClose={() => setTicketBooking(null)}
            />
          </div>
        </div>
      )}

      {changeSeatId && (
        <div className="modal-backdrop" onClick={() => setChangeSeatId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>تغيير المقعد</h2>
            {(() => {
              const booking = state.bookings.find((b) => b.id === changeSeatId)!
              const s = getTripSeats(booking.tripId)
              const available = s.bookedSeats.filter((n) => n !== booking.seatNumber)
              return (
                <SeatMap
                  total={s.total}
                  bookedSeats={available}
                  selected={booking.seatNumber}
                  onSelect={(n) => handleChangeSeat(changeSeatId, n)}
                />
              )
            })()}
            <button type="button" className="btn btn-ghost" onClick={() => setChangeSeatId(null)}>
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
