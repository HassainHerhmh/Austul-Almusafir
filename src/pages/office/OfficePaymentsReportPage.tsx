import { useMemo, useState } from 'react'
import {
  PAYMENT_LABELS,
  daysAgoStr,
  formatMoney,
  formatTimeAr,
  todayStr,
} from '../../components/utils'
import { useApp } from '../../context/AppContext'
import type { PaymentMethod } from '../../types'

type MethodFilter = 'all' | PaymentMethod

export function OfficePaymentsReportPage() {
  const { state, currentOffice, can, getTripLabel } = useApp()
  const officeId = currentOffice!.id
  const today = todayStr()

  const [fromDate, setFromDate] = useState(daysAgoStr(30))
  const [toDate, setToDate] = useState(today)
  const [method, setMethod] = useState<MethodFilter>('all')
  const [customerQuery, setCustomerQuery] = useState('')

  const filtered = useMemo(() => {
    const q = customerQuery.trim().toLowerCase()
    return state.bookings
      .filter((b) => b.officeId === officeId && b.status === 'confirmed')
      .filter((b) => {
        const day = b.bookedAt.slice(0, 10)
        if (fromDate && day < fromDate) return false
        if (toDate && day > toDate) return false
        if (method !== 'all' && b.paymentMethod !== method) return false
        if (!q) return true
        const customer = state.customers.find((c) => c.id === b.customerId)
        const hay = [
          b.passengerName,
          b.ticketNumber,
          b.passportNumber,
          customer?.name,
          customer?.phone,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))
  }, [state.bookings, state.customers, officeId, fromDate, toDate, method, customerQuery])

  const totals = useMemo(() => {
    const cash = filtered.filter((b) => b.paymentMethod === 'cash').reduce((s, b) => s + b.price, 0)
    const transfer = filtered
      .filter((b) => b.paymentMethod === 'transfer')
      .reduce((s, b) => s + b.price, 0)
    const credit = filtered
      .filter((b) => b.paymentMethod === 'credit')
      .reduce((s, b) => s + b.price, 0)
    return {
      cash,
      transfer,
      credit,
      all: cash + transfer + credit,
      count: filtered.length,
    }
  }, [filtered])

  if (!can('view_reports')) {
    return (
      <div className="panel">
        <div className="empty">ليس لديك صلاحية التقارير</div>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>تقرير المدفوعات</h1>
          <p>نقدي · حوالة · آجل — مع فلترة بالعميل والفترة</p>
        </div>
      </header>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <form
          className="form-grid"
          onSubmit={(e) => e.preventDefault()}
          style={{ alignItems: 'end' }}
        >
          <div className="field">
            <label>من تاريخ</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="field">
            <label>إلى تاريخ</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="field">
            <label>طريقة الدفع</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as MethodFilter)}>
              <option value="all">الكل</option>
              <option value="cash">نقدي</option>
              <option value="transfer">حوالة</option>
              <option value="credit">آجل</option>
            </select>
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>بحث عميل / راكب</label>
            <input
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              placeholder="اسم، هاتف، رقم تذكرة، جواز…"
            />
          </div>
        </form>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">نقدي</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(totals.cash)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">حوالة</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(totals.transfer)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">آجل</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(totals.credit)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">الإجمالي ({totals.count})</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(totals.all)}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>تفاصيل المدفوعات</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الراكب / العميل</th>
                <th>الهاتف</th>
                <th>التذكرة</th>
                <th>الرحلة</th>
                <th>طريقة الدفع</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    لا توجد مدفوعات مطابقة للفلتر
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const customer = state.customers.find((c) => c.id === b.customerId)
                  const trip = state.trips.find((t) => t.id === b.tripId)
                  return (
                    <tr key={b.id}>
                      <td>{b.bookedAt.slice(0, 10)}</td>
                      <td>
                        <div>{b.passengerName}</div>
                        {customer?.name && customer.name !== b.passengerName ? (
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                            {customer.name}
                          </div>
                        ) : null}
                      </td>
                      <td>{customer?.phone || '—'}</td>
                      <td>{b.ticketNumber || '—'}</td>
                      <td>
                        {trip ? (
                          <>
                            {getTripLabel(trip)}
                            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                              {trip.date} {formatTimeAr(trip.departureTime)}
                            </div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            b.paymentMethod === 'cash'
                              ? 'badge-ok'
                              : b.paymentMethod === 'transfer'
                                ? 'badge-info'
                                : 'badge-warn'
                          }`}
                        >
                          {PAYMENT_LABELS[b.paymentMethod]}
                        </span>
                      </td>
                      <td>{formatMoney(b.price)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
