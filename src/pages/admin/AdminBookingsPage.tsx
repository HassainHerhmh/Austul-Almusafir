import { useEffect, useMemo, useState } from 'react'
import { TicketView } from '../../components/TicketView'
import { PAYMENT_LABELS, formatMoney, formatTimeAr, todayStr } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import { useBrand } from '../../context/BrandContext'
import type { Booking, PaymentMethod } from '../../types'
import { printTableReport } from '../../utils/importExport'

const PRINT_COLUMNS = [
  { key: 'passenger', label: 'الراكب' },
  { key: 'ticketNumber', label: 'رقم التذكرة' },
  { key: 'passport', label: 'رقم الجواز' },
  { key: 'visa', label: 'نوع التأشيرة' },
  { key: 'boarding', label: 'منطقة الانطلاق' },
  { key: 'arrival', label: 'منطقة الوصول' },
  { key: 'seat', label: 'المقعد' },
  { key: 'branch', label: 'الفرع' },
  { key: 'office', label: 'المكتب' },
  { key: 'trip', label: 'الرحلة' },
  { key: 'bookedAt', label: 'تاريخ الحجز' },
  { key: 'status', label: 'الحالة' },
  { key: 'price', label: 'السعر' },
  { key: 'notes', label: 'الملاحظات' },
] as const

type PrintColKey = (typeof PRINT_COLUMNS)[number]['key']

const DEFAULT_PRINT_COLS: Record<PrintColKey, boolean> = Object.fromEntries(
  PRINT_COLUMNS.map((c) => [c.key, true]),
) as Record<PrintColKey, boolean>

export function AdminBookingsPage() {
  const {
    state,
    getTripLabel,
    getOffice,
    getBranch,
    getDestination,
    updateBooking,
    deleteBooking,
    isBranchAdmin,
    currentBranch,
  } = useApp()
  const [branchFilter, setBranchFilter] = useState<string>('')
  const [officeFilter, setOfficeFilter] = useState('')
  const [tripFilter, setTripFilter] = useState('')
  const [filterDate, setFilterDate] = useState('')

  useEffect(() => {
    if (isBranchAdmin && currentBranch?.id) setBranchFilter(currentBranch.id)
  }, [isBranchAdmin, currentBranch?.id])

  const officeOptions = useMemo(() => {
    let offices = [...state.offices]
    if (branchFilter === '__agency__') {
      offices = offices.filter((o) => !o.branchId)
    } else if (branchFilter) {
      offices = offices.filter((o) => o.branchId === branchFilter)
    }
    return offices.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  }, [state.offices, branchFilter])

  const tripOptions = useMemo(
    () =>
      [...state.trips].sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.departureTime.localeCompare(a.departureTime),
      ),
    [state.trips],
  )

  useEffect(() => {
    if (officeFilter && !officeOptions.some((o) => o.id === officeFilter)) {
      setOfficeFilter('')
    }
  }, [officeFilter, officeOptions])
  const { name: companyName, logoUrl, phones } = useBrand()

  const [editBooking, setEditBooking] = useState<Booking | null>(null)
  const [ticketBooking, setTicketBooking] = useState<Booking | null>(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [printCols, setPrintCols] = useState<Record<PrintColKey, boolean>>(DEFAULT_PRINT_COLS)
  const [editForm, setEditForm] = useState({
    passengerName: '',
    ticketNumber: '',
    passportNumber: '',
    visaTypeId: '',
    boardingDestinationId: '',
    arrivalDestinationId: '',
    seatNumber: 1,
    paymentMethod: 'cash' as PaymentMethod,
    notes: '',
    price: 0,
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  const openEdit = (b: Booking) => {
    setEditBooking(b)
    setEditForm({
      passengerName: b.passengerName,
      ticketNumber: b.ticketNumber || '',
      passportNumber: b.passportNumber || '',
      visaTypeId: b.visaTypeId || '',
      boardingDestinationId: b.boardingDestinationId || '',
      arrivalDestinationId: b.arrivalDestinationId || '',
      seatNumber: b.seatNumber,
      paymentMethod: b.paymentMethod,
      notes: b.notes || '',
      price: b.price,
    })
    setEditError(null)
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editBooking) return
    if (!editForm.passengerName.trim()) {
      setEditError('اسم الراكب مطلوب')
      return
    }
    if (!Number.isFinite(editForm.price) || editForm.price < 0) {
      setEditError('سعر التذكرة غير صالح')
      return
    }
    setBusy(true)
    setEditError(null)
    const err = await updateBooking(editBooking.id, {
      passengerName: editForm.passengerName.trim(),
      ticketNumber: editForm.ticketNumber.trim(),
      passportNumber: editForm.passportNumber.trim(),
      visaTypeId: editForm.visaTypeId,
      boardingDestinationId: editForm.boardingDestinationId,
      arrivalDestinationId: editForm.arrivalDestinationId,
      seatNumber: editForm.seatNumber,
      paymentMethod: editForm.paymentMethod,
      notes: editForm.notes.trim(),
      price: editForm.price,
    })
    setBusy(false)
    if (err) {
      setEditError(err)
      return
    }
    setEditBooking(null)
  }

  const cancelBooking = async (b: Booking) => {
    if (!confirm(`إلغاء تذكرة «${b.passengerName}»؟ سيتم حذف قيود المحاسبة المرتبطة.`)) return
    const err = await updateBooking(b.id, { status: 'cancelled' })
    if (err) alert(err)
  }

  const removeBooking = async (b: Booking) => {
    if (
      !confirm(
        `حذف تذكرة «${b.passengerName}» نهائياً؟ سيتم حذف قيود المحاسبة والسندات المرتبطة.`,
      )
    ) {
      return
    }
    const err = await deleteBooking(b.id)
    if (err) alert(err)
  }

  const branchLabelForOffice = (officeId: string) => {
    const office = getOffice(officeId)
    if (!office?.branchId) return 'الوكالة'
    return office.branchName ?? getBranch(office.branchId)?.name ?? '—'
  }

  const sortedBookings = useMemo(() => {
    let list = state.bookings
    if (branchFilter === '__agency__') {
      list = list.filter((b) => !getOffice(b.officeId)?.branchId)
    } else if (branchFilter) {
      list = list.filter((b) => getOffice(b.officeId)?.branchId === branchFilter)
    }
    if (officeFilter) list = list.filter((b) => b.officeId === officeFilter)
    if (tripFilter) list = list.filter((b) => b.tripId === tripFilter)
    if (filterDate) list = list.filter((b) => b.bookedAt.slice(0, 10) === filterDate)
    return [...list].sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))
  }, [state.bookings, branchFilter, officeFilter, tripFilter, filterDate, getOffice])

  const cellValue = (b: Booking, key: PrintColKey): string => {
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
      case 'seat':
        return String(b.seatNumber)
      case 'branch':
        return branchLabelForOffice(b.officeId)
      case 'office':
        return getOffice(b.officeId)?.name || '—'
      case 'trip':
        return trip ? getTripLabel(trip) : '—'
      case 'bookedAt':
        return b.bookedAt.slice(0, 16).replace('T', ' ')
      case 'status':
        return b.status === 'confirmed' ? 'مؤكد' : 'ملغى'
      case 'price':
        return trip?.tripKind === 'campaign' ? 'حملة' : formatMoney(b.price)
      case 'notes':
        return b.notes?.trim() ? b.notes : '—'
      default:
        return '—'
    }
  }

  const doPrint = () => {
    const selected = PRINT_COLUMNS.filter((c) => printCols[c.key])
    if (selected.length === 0) {
      alert('اختر عموداً واحداً على الأقل')
      return
    }
    printTableReport({
      title: 'متابعة الحجوزات',
      companyName,
      logoUrl,
      phones,
      headers: selected.map((c) => c.label),
      rows: sortedBookings.map((b) => selected.map((c) => cellValue(b, c.key))),
    })
    setPrintOpen(false)
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>متابعة الحجوزات</h1>
          <p>تعديل · إلغاء · حذف — الإلغاء والحذف يحذفان قيود المحاسبة</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setPrintOpen(true)}>
          طباعة
        </button>
      </header>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>قائمة الحجوزات</h2>
          <div
            className="actions"
            style={{
              flexWrap: 'wrap',
              gap: '0.65rem',
              marginInlineStart: 'auto',
              alignItems: 'center',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <span style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>الفرع</span>
              {isBranchAdmin ? (
                <select
                  value={branchFilter}
                  disabled
                  className="filter-select"
                  aria-readonly
                >
                  <option value={currentBranch?.id ?? ''}>{currentBranch?.name ?? 'الفرع'}</option>
                </select>
              ) : (
                <select
                  value={branchFilter}
                  onChange={(e) => {
                    setBranchFilter(e.target.value)
                    setOfficeFilter('')
                  }}
                  className="filter-select"
                >
                  <option value="">كل الفروع</option>
                  <option value="__agency__">مباشرة للوكالة</option>
                  {state.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <span style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>المكتب</span>
              <select
                value={officeFilter}
                onChange={(e) => setOfficeFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">كل المكاتب</option>
                {officeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <span style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>الرحلة</span>
              <select
                value={tripFilter}
                onChange={(e) => setTripFilter(e.target.value)}
                className="filter-select"
                style={{ maxWidth: 280 }}
              >
                <option value="">كل الرحلات</option>
                {tripOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {getTripLabel(t)} — {t.date} {formatTimeAr(t.departureTime)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <span style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>تاريخ الحجز</span>
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
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setFilterDate('')}
              disabled={!filterDate}
            >
              كل الأيام
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {isBranchAdmin && <th style={{ width: 88 }}>طباعة</th>}
                <th>الراكب</th>
                <th>رقم التذكرة</th>
                <th>رقم الجواز</th>
                <th>نوع التأشيرة</th>
                <th>منطقة الانطلاق</th>
                <th>منطقة الوصول</th>
                <th>المقعد</th>
                <th>الفرع</th>
                <th>المكتب</th>
                <th>الرحلة</th>
                <th>تاريخ الحجز</th>
                <th>الحالة</th>
                <th>السعر</th>
                <th>الملاحظات</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedBookings.map((b) => {
                  const trip = state.trips.find((t) => t.id === b.tripId)
                  return (
                    <tr key={b.id}>
                      {isBranchAdmin && (
                        <td>
                          {b.status === 'confirmed' && trip ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setTicketBooking(b)}
                            >
                              طباعة
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      <td>{b.passengerName}</td>
                      <td>{b.ticketNumber || '—'}</td>
                      <td>{b.passportNumber || '—'}</td>
                      <td>{state.visaTypes.find((v) => v.id === b.visaTypeId)?.name || '—'}</td>
                      <td>{getDestination(b.boardingDestinationId)?.name || '—'}</td>
                      <td>{getDestination(b.arrivalDestinationId)?.name || '—'}</td>
                      <td>{b.seatNumber}</td>
                      <td>{branchLabelForOffice(b.officeId)}</td>
                      <td>{getOffice(b.officeId)?.name}</td>
                      <td>{trip ? getTripLabel(trip) : '—'}</td>
                      <td>{b.bookedAt.slice(0, 16).replace('T', ' ')}</td>
                      <td>
                        <span
                          className={`badge ${
                            b.status === 'confirmed' ? 'badge-ok' : 'badge-danger'
                          }`}
                        >
                          {b.status === 'confirmed' ? 'مؤكد' : 'ملغى'}
                        </span>
                      </td>
                      <td>
                        {trip?.tripKind === 'campaign' ? 'حملة' : formatMoney(b.price)}
                      </td>
                      <td>{b.notes?.trim() ? b.notes : '—'}</td>
                      <td>
                        <div className="actions">
                          {b.status === 'confirmed' && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => openEdit(b)}
                            >
                              تعديل
                            </button>
                          )}
                          {b.status === 'confirmed' && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => void cancelBooking(b)}
                            >
                              إلغاء
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => void removeBooking(b)}
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              {sortedBookings.length === 0 && (
                <tr>
                  <td colSpan={isBranchAdmin ? 16 : 15} className="empty">
                    لا توجد حجوزات مطابقة للفلتر
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
            <h2>طباعة الحجوزات</h2>
            <p style={{ color: 'var(--muted)', marginTop: 0 }}>
              اختر الأعمدة التي تريد طباعتها. الكليشة (الشعار والاسم والأرقام) من الإعدادات.
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
              <button type="button" className="btn btn-primary" onClick={doPrint}>
                طباعة
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPrintOpen(false)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {ticketBooking && (
        <div className="modal-backdrop" onClick={() => setTicketBooking(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const trip = state.trips.find((t) => t.id === ticketBooking.tripId)
              if (!trip) return <p className="empty">الرحلة غير موجودة</p>
              return (
                <TicketView
                  booking={ticketBooking}
                  trip={trip}
                  onClose={() => setTicketBooking(null)}
                />
              )
            })()}
          </div>
        </div>
      )}

      {editBooking && (
        <div className="modal-backdrop" onClick={() => setEditBooking(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>تعديل التذكرة</h2>
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
                    value={editForm.visaTypeId}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, visaTypeId: e.target.value }))
                    }
                  >
                    <option value="">—</option>
                    {state.visaTypes.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>المقعد</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editForm.seatNumber}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        seatNumber: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label>سعر التذكرة (ر.س)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={editForm.price}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        price: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                  />
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
                    <option value="cash">{PAYMENT_LABELS.cash}</option>
                    <option value="transfer">{PAYMENT_LABELS.transfer}</option>
                    <option value="credit">{PAYMENT_LABELS.credit}</option>
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
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'جاري الحفظ…' : 'حفظ'}
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
