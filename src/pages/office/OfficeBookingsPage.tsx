import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SeatMap } from '../../components/SeatMap'
import { TicketView } from '../../components/TicketView'
import { PAYMENT_LABELS, formatMoney, formatTimeAr, todayStr } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import { useBrand } from '../../context/BrandContext'
import { serverApi } from '../../api/serverApi'
import type { Booking, PaymentMethod } from '../../types'
import { printTableReport, downloadExcelReport } from '../../utils/importExport'

const PRINT_COLUMNS = [
  { key: 'passenger', label: 'الراكب' },
  { key: 'ticketNumber', label: 'رقم التذكرة' },
  { key: 'passport', label: 'رقم الجواز' },
  { key: 'visa', label: 'نوع التأشيرة' },
  { key: 'boarding', label: 'منطقة الانطلاق' },
  { key: 'arrival', label: 'منطقة الوصول' },
  { key: 'trip', label: 'الرحلة' },
  { key: 'seat', label: 'المقعد' },
  { key: 'payment', label: 'الدفع' },
  { key: 'notes', label: 'الملاحظات' },
  { key: 'status', label: 'الحالة' },
  { key: 'price', label: 'السعر' },
  { key: 'addedBy', label: 'أضافه' },
] as const

type PrintColKey = (typeof PRINT_COLUMNS)[number]['key']

const DEFAULT_PRINT_COLS: Record<PrintColKey, boolean> = Object.fromEntries(
  PRINT_COLUMNS.map((c) => [c.key, true]),
) as Record<PrintColKey, boolean>

export function OfficeBookingsPage() {
  const {
    state,
    currentUser,
    currentOffice,
    can,
    getTripLabel,
    getTripSeats,
    getDestination,
    getDriver,
    createBooking,
    updateBooking,
    refreshBookings,
    ensureTripSeats,
  } = useApp()
  const { name: companyName, logoUrl, phones } = useBrand()
  const [params] = useSearchParams()
  const officeId = currentOffice!.id
  const officeBookingsByTrip = useMemo(
    () =>
      state.bookings.reduce<Record<string, number>>((acc, booking) => {
        if (booking.officeId === officeId && booking.status === 'confirmed') {
          acc[booking.tripId] = (acc[booking.tripId] ?? 0) + 1
        }
        return acc
      }, {}),
    [state.bookings, officeId],
  )

  // تحديث المقاعد/الحجوزات في الخلفية كل 10 ثوانٍ
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'hidden') return
      void refreshBookings()
    }
    const id = window.setInterval(tick, 10_000)
    return () => window.clearInterval(id)
  }, [refreshBookings])

  const trips = useMemo(
    () =>
      state.trips
        .filter((t) => {
          if (t.status !== 'open') return false
          // حملة: تظهر لمكتب الحملة بأي تاريخ
          if (t.tripKind === 'campaign') {
            return !t.campaignOfficeId || t.campaignOfficeId === officeId
          }
          return true
        })
        .sort((a, b) => {
          if (a.tripKind === 'campaign' && b.tripKind !== 'campaign') return -1
          if (b.tripKind === 'campaign' && a.tripKind !== 'campaign') return 1
          return b.date.localeCompare(a.date) || b.departureTime.localeCompare(a.departureTime)
        }),
    [state.trips, officeId],
  )

  const [tripId, setTripId] = useState(params.get('trip') ?? trips[0]?.id ?? '')
  const [seat, setSeat] = useState<number | null>(null)
  const [passengerName, setPassengerName] = useState('')
  const [ticketNumber, setTicketNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [passportNumber, setPassportNumber] = useState('')
  const [visaTypeId, setVisaTypeId] = useState('')
  const [boardingDestinationId, setBoardingDestinationId] = useState('')
  const [arrivalDestinationId, setArrivalDestinationId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ticketBooking, setTicketBooking] = useState<Booking | null>(null)
  const [editBooking, setEditBooking] = useState<Booking | null>(null)
  const [filterDate, setFilterDate] = useState(todayStr())
  const [printMenuOpen, setPrintMenuOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [printFormat, setPrintFormat] = useState<'excel' | 'pdf'>('pdf')
  const [printCols, setPrintCols] = useState<Record<PrintColKey, boolean>>(DEFAULT_PRINT_COLS)
  const [editForm, setEditForm] = useState({
    passengerName: '',
    ticketNumber: '',
    passportNumber: '',
    visaTypeId: '',
    boardingDestinationId: '',
    arrivalDestinationId: '',
    paymentMethod: 'cash' as PaymentMethod,
    notes: '',
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [editBusy, setEditBusy] = useState(false)
  const [bookingBusy, setBookingBusy] = useState(false)

  const selectedTrip = useMemo(
    () => state.trips.find((t) => t.id === tripId) ?? null,
    [state.trips, tripId],
  )

  useEffect(() => {
    if (!tripId) return
    void ensureTripSeats(tripId)
  }, [tripId, ensureTripSeats])

  useEffect(() => {
    if (!trips.length) {
      if (tripId) setTripId('')
      return
    }
    if (!trips.some((t) => t.id === tripId)) {
      setTripId(trips[0].id)
    }
  }, [trips, tripId])

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

  const myBookings = useMemo(
    () =>
      state.bookings
        .filter((b) => b.officeId === officeId)
        .filter((b) => !filterDate || b.bookedAt.slice(0, 10) === filterDate)
        .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt)),
    [state.bookings, officeId, filterDate],
  )

  const printCell = (b: Booking, key: PrintColKey): string => {
    const trip = state.trips.find((t) => t.id === b.tripId)
    switch (key) {
      case 'passenger':
        return b.passengerName
      case 'ticketNumber':
        return b.ticketNumber || '—'
      case 'passport':
        return b.passportNumber || '—'
      case 'visa':
        return state.visaTypes.find((v) => v.id === b.visaTypeId)?.name || '—'
      case 'boarding':
        return getDestination(b.boardingDestinationId)?.name || '—'
      case 'arrival':
        return getDestination(b.arrivalDestinationId)?.name || '—'
      case 'trip':
        return trip ? getTripLabel(trip) : '—'
      case 'seat':
        return String(b.seatNumber)
      case 'payment':
        return PAYMENT_LABELS[b.paymentMethod]
      case 'notes':
        return b.notes?.trim() ? b.notes : '—'
      case 'status':
        return b.status === 'confirmed' ? 'مؤكد' : 'ملغى'
      case 'price':
        return trip?.tripKind === 'campaign' ? 'حملة' : formatMoney(b.price)
      case 'addedBy':
        return state.users.find((u) => u.id === b.bookedBy)?.name || '—'
      default:
        return '—'
    }
  }

  const openPrintModal = (format: 'excel' | 'pdf') => {
    setPrintFormat(format)
    setPrintMenuOpen(false)
    setPrintOpen(true)
  }

  const doPrint = async () => {
    const selected = PRINT_COLUMNS.filter((c) => printCols[c.key])
    if (selected.length === 0) {
      alert('اختر عموداً واحداً على الأقل')
      return
    }
    const headers = selected.map((c) => c.label)
    const dataRows = myBookings.map((b) => selected.map((c) => printCell(b, c.key)))
    const title = `حجوزات ${currentOffice?.name ?? ''}`
    const headersWithNum = ['#', ...headers]
    const rowsWithNum = dataRows.map((row, i) => [String(i + 1), ...row])

    const tripIds = [...new Set(myBookings.map((b) => b.tripId))]
    const tripMeta = tripIds.map((id) => {
      const trip = state.trips.find((t) => t.id === id)
      const bus = trip ? state.buses.find((b) => b.id === trip.busId) : undefined
      const driver = trip ? getDriver(trip.driverId) : undefined
      return {
        route: trip ? getTripLabel(trip) : '—',
        driver: driver?.name || '—',
        assistant: trip?.assistantName?.trim() || '—',
        busNumber: bus?.busNumber || '—',
        plateNumber: bus?.plateNumber || '—',
      }
    })

    if (printFormat === 'excel') {
      downloadExcelReport({
        filename: `حجوزات_${currentOffice?.name ?? 'المكتب'}_${filterDate || todayStr()}.xlsx`,
        title,
        companyName,
        phones,
        tripMeta,
        headers: headersWithNum,
        rows: rowsWithNum,
      })
    } else {
      let printSettings = null
      try {
        const res = await serverApi.settings.print.get()
        printSettings = res.data
      } catch {
        /* افتراضي */
      }
      printTableReport({
        title,
        companyName,
        logoUrl,
        phones,
        tripMeta,
        printSettings,
        headers: headersWithNum,
        rows: rowsWithNum,
      })
    }
    setPrintOpen(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (bookingBusy) return
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
    setBookingBusy(true)
    setError(null)
    try {
      const result = await createBooking({
        tripId,
        officeId,
        passengerName,
        ticketNumber,
        phone,
        passportNumber,
        visaTypeId,
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
      setPassengerName('')
      setTicketNumber('')
      setPhone('')
      setPassportNumber('')
      setVisaTypeId('')
      setNotes('')
      setSeat(null)
      setTicketBooking(result)
    } finally {
      setBookingBusy(false)
    }
  }

  const openEdit = (b: Booking) => {
    setEditBooking(b)
    setEditForm({
      passengerName: b.passengerName,
      ticketNumber: b.ticketNumber || '',
      passportNumber: b.passportNumber || '',
      visaTypeId: b.visaTypeId || '',
      boardingDestinationId: b.boardingDestinationId || '',
      arrivalDestinationId: b.arrivalDestinationId || '',
      paymentMethod: b.paymentMethod,
      notes: b.notes || '',
    })
    setEditError(null)
  }

  const editTrip = editBooking
    ? state.trips.find((t) => t.id === editBooking.tripId) ?? null
    : null

  const editRouteStops = useMemo(() => {
    if (!editTrip?.stops?.length) return []
    const seen = new Set<string>()
    return editTrip.stops.filter((s) => {
      if (!s.destinationId || seen.has(s.destinationId)) return false
      seen.add(s.destinationId)
      return true
    })
  }, [editTrip])

  const editBoardingStops =
    editRouteStops.length < 2 ? editRouteStops : editRouteStops.slice(0, -1)

  const editArrivalStops = useMemo(() => {
    if (!editRouteStops.length || !editForm.boardingDestinationId) return []
    const idx = editRouteStops.findIndex(
      (s) => s.destinationId === editForm.boardingDestinationId,
    )
    if (idx < 0) return editRouteStops.slice(1)
    return editRouteStops.slice(idx + 1)
  }, [editRouteStops, editForm.boardingDestinationId])

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editBooking) return
    if (!editForm.passengerName.trim()) {
      setEditError('اسم الراكب مطلوب')
      return
    }
    if (!editForm.boardingDestinationId || !editForm.arrivalDestinationId) {
      setEditError('اختر مناطق الانطلاق والوصول')
      return
    }
    setEditBusy(true)
    setEditError(null)
    const err = await updateBooking(editBooking.id, {
      passengerName: editForm.passengerName.trim(),
      ticketNumber: editForm.ticketNumber.trim(),
      passportNumber: editForm.passportNumber.trim(),
      visaTypeId: editForm.visaTypeId,
      boardingDestinationId: editForm.boardingDestinationId,
      arrivalDestinationId: editForm.arrivalDestinationId,
      paymentMethod: editForm.paymentMethod,
      notes: editForm.notes.trim(),
    })
    setEditBusy(false)
    if (err) {
      setEditError(err)
      return
    }
    setEditBooking(null)
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
                <span className="badge badge-danger">
                  حجوزات مكتبك {officeBookingsByTrip[tripId] ?? 0}
                </span>
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
                    const officeBookedCount = officeBookingsByTrip[t.id] ?? 0
                    return (
                      <option key={t.id} value={t.id}>
                        {t.tripKind === 'campaign' ? '[حملة] ' : ''}
                        {getTripLabel(t)} — {t.date} {formatTimeAr(t.departureTime)} (متبقي{' '}
                        {s.remaining} | حجوزاتك {officeBookedCount})
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
                <label>نوع التأشيرة</label>
                <select
                  required
                  value={visaTypeId}
                  onChange={(e) => setVisaTypeId(e.target.value)}
                >
                  <option value="">اختر نوع التأشيرة</option>
                  {state.visaTypes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
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
                disabled={
                  bookingBusy || !seat || !boardingDestinationId || !arrivalDestinationId
                }
              >
                {bookingBusy
                  ? 'جاري الحجز…'
                  : `تأكيد الحجز ${seat ? `(مقعد ${seat})` : ''}`}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2>حجوزات {currentOffice?.name}</h2>
          <div className="actions" style={{ marginInlineStart: 'auto' }}>
            <label className="field" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>اليوم</span>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setFilterDate(todayStr())}
            >
              اليوم
            </button>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setPrintMenuOpen((v) => !v)}
                aria-expanded={printMenuOpen}
              >
                طباعة
              </button>
              {printMenuOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                    onClick={() => setPrintMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 6px)',
                      left: 0,
                      zIndex: 50,
                      minWidth: 140,
                      background: 'var(--panel, #fff)',
                      border: '1px solid var(--border, #e5e7eb)',
                      borderRadius: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,.12)',
                      overflow: 'hidden',
                      padding: 4,
                    }}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="btn btn-ghost btn-sm"
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                      onClick={() => openPrintModal('excel')}
                    >
                      Excel
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="btn btn-ghost btn-sm"
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                      onClick={() => openPrintModal('pdf')}
                    >
                      PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th>الراكب</th>
                <th>رقم التذكرة</th>
                <th>رقم الجواز</th>
                <th>نوع التأشيرة</th>
                <th>منطقة الانطلاق</th>
                <th>منطقة الوصول</th>
                <th>الرحلة</th>
                <th>المقعد</th>
                <th>الدفع</th>
                <th>الملاحظات</th>
                <th>الحالة</th>
                <th>السعر</th>
                <th>أضافه</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {myBookings.map((b, idx) => {
                const trip = state.trips.find((t) => t.id === b.tripId)
                const addedBy = state.users.find((u) => u.id === b.bookedBy)
                return (
                  <tr key={b.id}>
                    <td>{idx + 1}</td>
                    <td>{b.passengerName}</td>
                    <td>{b.ticketNumber || '—'}</td>
                    <td>{b.passportNumber || '—'}</td>
                    <td>
                      {state.visaTypes.find((v) => v.id === b.visaTypeId)?.name || '—'}
                    </td>
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
                    <td>
                      {trip?.tripKind === 'campaign' ? 'حملة' : formatMoney(b.price)}
                    </td>
                    <td>{addedBy?.name || '—'}</td>
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
                            onClick={() => openEdit(b)}
                          >
                            تعديل
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
              {myBookings.length === 0 && (
                <tr>
                  <td colSpan={15} className="empty">
                    لا توجد حجوزات لهذا اليوم
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {printOpen && (
        <div className="modal-backdrop" onClick={() => setPrintOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{printFormat === 'excel' ? 'تصدير Excel' : 'طباعة PDF'}</h2>
            <p style={{ color: 'var(--muted)', marginTop: 0 }}>
              اختر الأعمدة {printFormat === 'excel' ? 'للتصدير' : 'للطباعة'} (حسب فلتر التاريخ
              المحدد).
            </p>
            <div className="actions" style={{ marginBottom: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setPrintCols(
                    Object.fromEntries(
                      PRINT_COLUMNS.map((c) => [c.key, true]),
                    ) as Record<PrintColKey, boolean>,
                  )
                }
              >
                تحديد الكل
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setPrintCols(
                    Object.fromEntries(
                      PRINT_COLUMNS.map((c) => [c.key, false]),
                    ) as Record<PrintColKey, boolean>,
                  )
                }
              >
                إلغاء الكل
              </button>
            </div>
            <div className="print-cols-grid">
              {PRINT_COLUMNS.map((c) => (
                <label key={c.key}>
                  <input
                    type="checkbox"
                    checked={printCols[c.key]}
                    onChange={(e) =>
                      setPrintCols((prev) => ({ ...prev, [c.key]: e.target.checked }))
                    }
                  />
                  {c.label}
                </label>
              ))}
            </div>
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={() => void doPrint()}>
                {printFormat === 'excel' ? 'تصدير Excel' : 'طباعة PDF'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPrintOpen(false)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

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

      {editBooking && (
        <div className="modal-backdrop" onClick={() => setEditBooking(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>تعديل الحجز</h2>
            <form onSubmit={(e) => void saveEdit(e)}>
              <div className="form-grid">
                <div className="field">
                  <label>اسم الراكب</label>
                  <input
                    required
                    value={editForm.passengerName}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, passengerName: e.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label>رقم التذكرة</label>
                  <input
                    value={editForm.ticketNumber}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, ticketNumber: e.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label>رقم الجواز</label>
                  <input
                    value={editForm.passportNumber}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, passportNumber: e.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label>نوع التأشيرة</label>
                  <select
                    required
                    value={editForm.visaTypeId}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, visaTypeId: e.target.value }))
                    }
                  >
                    <option value="">اختر نوع التأشيرة</option>
                    {state.visaTypes.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>منطقة الانطلاق</label>
                  <select
                    required
                    value={editForm.boardingDestinationId}
                    onChange={(e) => {
                      const boardId = e.target.value
                      const idx = editRouteStops.findIndex((s) => s.destinationId === boardId)
                      const nextArrivals =
                        idx < 0 ? editRouteStops.slice(1) : editRouteStops.slice(idx + 1)
                      setEditForm((f) => ({
                        ...f,
                        boardingDestinationId: boardId,
                        arrivalDestinationId:
                          nextArrivals[nextArrivals.length - 1]?.destinationId ?? '',
                      }))
                    }}
                  >
                    {editBoardingStops.map((s) => (
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
                    value={editForm.arrivalDestinationId}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, arrivalDestinationId: e.target.value }))
                    }
                  >
                    {editArrivalStops.map((s) => (
                      <option key={s.destinationId} value={s.destinationId}>
                        {getDestination(s.destinationId)?.name ?? s.destinationId}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>طريقة الدفع</label>
                  <select
                    value={editForm.paymentMethod}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        paymentMethod: e.target.value as PaymentMethod,
                      }))
                    }
                  >
                    <option value="cash">نقدي</option>
                    <option value="transfer">تحويل</option>
                    <option value="credit">آجل</option>
                  </select>
                </div>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>الملاحظات</label>
                  <input
                    value={editForm.notes}
                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              {editError && <p className="error-msg">{editError}</p>}
              <div className="actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={editBusy}>
                  {editBusy ? 'جاري الحفظ…' : 'حفظ'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEditBooking(null)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
