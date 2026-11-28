import { useEffect, useMemo, useState } from 'react'
import { TicketView } from '../../components/TicketView'
import { TlbConfirmUploadButton } from '../../components/TlbConfirmUploadButton'
import { PAYMENT_LABELS, formatMoney, formatTimeAr, todayStr } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import { useBrand } from '../../context/BrandContext'
import type { Booking } from '../../types'
import { printTableReport } from '../../utils/importExport'
import { tripNumberLabel } from '../../utils/trip'

const PRINT_COLUMNS = [
  { key: 'passenger', label: 'الراكب' },
  { key: 'ticketNumber', label: 'رقم التذكرة' },
  { key: 'office', label: 'المكتب' },
  { key: 'trip', label: 'الرحلة' },
  { key: 'seat', label: 'المقعد' },
  { key: 'bookedAt', label: 'تاريخ الحجز' },
  { key: 'status', label: 'الحالة' },
  { key: 'price', label: 'السعر' },
] as const

type PrintColKey = (typeof PRINT_COLUMNS)[number]['key']

export function BranchBookingsPage() {
  const {
    state,
    currentBranch,
    getTripLabel,
    getOffice,
    refreshBookings,
  } = useApp()
  const { name: companyName, logoUrl, phones } = useBrand()

  const branchOffices = useMemo(
    () =>
      state.offices
        .filter((o) => o.branchId === currentBranch?.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [state.offices, currentBranch?.id],
  )
  const officeIds = useMemo(() => new Set(branchOffices.map((o) => o.id)), [branchOffices])

  const [officeFilter, setOfficeFilter] = useState('')
  const [tripFilter, setTripFilter] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [ticketBooking, setTicketBooking] = useState<Booking | null>(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [printCols, setPrintCols] = useState<Record<PrintColKey, boolean>>(
    Object.fromEntries(PRINT_COLUMNS.map((c) => [c.key, true])) as Record<PrintColKey, boolean>,
  )

  const tripOptions = useMemo(
    () =>
      [...state.trips].sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.departureTime.localeCompare(a.departureTime),
      ),
    [state.trips],
  )

  useEffect(() => {
    if (officeFilter && !branchOffices.some((o) => o.id === officeFilter)) {
      setOfficeFilter('')
    }
  }, [officeFilter, branchOffices])

  const rows = useMemo(() => {
    let list = state.bookings.filter((b) => officeIds.has(b.officeId))
    if (officeFilter) list = list.filter((b) => b.officeId === officeFilter)
    if (tripFilter) list = list.filter((b) => b.tripId === tripFilter)
    if (filterDate) list = list.filter((b) => b.bookedAt.slice(0, 10) === filterDate)
    return [...list].sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))
  }, [state.bookings, officeIds, officeFilter, tripFilter, filterDate])

  const cellValue = (b: Booking, key: PrintColKey): string => {
    const trip = state.trips.find((t) => t.id === b.tripId)
    switch (key) {
      case 'passenger':
        return b.passengerName
      case 'ticketNumber':
        return b.ticketNumber || '—'
      case 'office':
        return getOffice(b.officeId)?.name || '—'
      case 'trip':
        return trip ? getTripLabel(trip) : '—'
      case 'seat':
        return String(b.seatNumber)
      case 'bookedAt':
        return b.bookedAt.slice(0, 16).replace('T', ' ')
      case 'status':
        return b.status === 'confirmed' ? 'مؤكد' : 'ملغى'
      case 'price':
        return trip?.tripKind === 'campaign' ? 'حملة' : formatMoney(b.price)
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
      title: `تذاكر الفرع — ${currentBranch?.name ?? ''}`,
      companyName,
      logoUrl,
      phones,
      headers: selected.map((c) => c.label),
      rows: rows.map((b) => selected.map((c) => cellValue(b, c.key))),
    })
    setPrintOpen(false)
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>التذاكر</h1>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            فرع {currentBranch?.name ?? '—'} — مكاتب الفرع وحجوزاتها
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setPrintOpen(true)}>
          طباعة القائمة
        </button>
      </header>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>قائمة التذاكر</h2>
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
              <span style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>المكتب</span>
              <select
                value={officeFilter}
                onChange={(e) => setOfficeFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">كل مكاتب الفرع</option>
                {branchOffices.map((o) => (
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
                <th style={{ width: 88 }}>تذكرة</th>
                <th>رقم الرحلة</th>
                <th>الراكب</th>
                <th>رقم التذكرة</th>
                <th>المكتب</th>
                <th>الرحلة</th>
                <th>المقعد</th>
                <th>الدفع</th>
                <th>تاريخ الحجز</th>
                <th>الحالة</th>
                <th>السعر</th>
                <th>رفع للهيئة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const trip = state.trips.find((t) => t.id === b.tripId)
                return (
                  <tr key={b.id}>
                    <td>
                      {b.status === 'confirmed' && trip ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setTicketBooking(b)}
                        >
                          تذكرة
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{trip ? (tripNumberLabel(trip) ?? '—') : '—'}</td>
                    <td>{b.passengerName}</td>
                    <td>{b.ticketNumber || '—'}</td>
                    <td>{getOffice(b.officeId)?.name ?? '—'}</td>
                    <td>{trip ? getTripLabel(trip) : '—'}</td>
                    <td>{b.seatNumber}</td>
                    <td>{PAYMENT_LABELS[b.paymentMethod]}</td>
                    <td>{b.bookedAt.slice(0, 16).replace('T', ' ')}</td>
                    <td>
                      <span
                        className={`badge ${b.status === 'confirmed' ? 'badge-ok' : 'badge-danger'}`}
                      >
                        {b.status === 'confirmed' ? 'مؤكد' : b.status === 'cancelled' ? 'ملغى' : b.status}
                      </span>
                    </td>
                    <td>{trip?.tripKind === 'campaign' ? 'حملة' : formatMoney(b.price)}</td>
                    <td>
                      <TlbConfirmUploadButton
                        booking={b}
                        onSuccess={() => void refreshBookings()}
                      />
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="empty">
                    لا توجد تذاكر مطابقة للفلتر
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
            <h2>طباعة قائمة التذاكر</h2>
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
    </div>
  )
}