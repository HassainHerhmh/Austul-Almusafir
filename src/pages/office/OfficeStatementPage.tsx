import { useMemo, useState } from 'react'
import { formatMoney, todayStr } from '../../components/utils'
import { serverApi } from '../../api/serverApi'
import { useApp } from '../../context/AppContext'

type PeriodType = 'day' | 'month' | 'range' | 'until'
type EntryKind = 'booking' | 'booking_commission' | 'admin_settlement'

type StatementRow = {
  id: number
  journal_date: string
  debit: number
  credit: number
  balance: number
  notes: string | null
  reference_type: string
  entry_label: string
}

function monthBounds(isoDate: string) {
  const [y, m] = isoDate.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return {
    from: `${y}-${String(m).padStart(2, '0')}-01`,
    to: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
  }
}

function resolvePeriod(
  period: PeriodType,
  day: string,
  from: string,
  to: string,
): { from: string | null; to: string | null } {
  if (period === 'day') return { from: day, to: day }
  if (period === 'month') return monthBounds(day)
  if (period === 'until') return { from: null, to: day }
  return { from, to }
}

const KIND_OPTIONS: { id: EntryKind; label: string }[] = [
  { id: 'booking', label: 'التذاكر' },
  { id: 'booking_commission', label: 'العمولات' },
  { id: 'admin_settlement', label: 'تسديدات الأدمن' },
]

export function OfficeStatementPage() {
  const { currentOffice, can, getOfficeAgencyBalance } = useApp()
  const officeId = currentOffice!.id
  const today = todayStr()

  const [period, setPeriod] = useState<PeriodType>('day')
  const [day, setDay] = useState(today)
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [kinds, setKinds] = useState<EntryKind[]>([
    'booking',
    'booking_commission',
    'admin_settlement',
  ])
  const [rows, setRows] = useState<StatementRow[]>([])
  const [closing, setClosing] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const agencyBalance = getOfficeAgencyBalance(officeId)

  const totals = useMemo(() => {
    const debit = rows.filter((r) => r.reference_type !== 'opening').reduce((s, r) => s + r.debit, 0)
    const credit = rows
      .filter((r) => r.reference_type !== 'opening')
      .reduce((s, r) => s + r.credit, 0)
    return { debit, credit }
  }, [rows])

  if (!can('view_accounts')) {
    return (
      <div className="panel">
        <div className="empty">ليس لديك صلاحية عرض الحسابات</div>
      </div>
    )
  }

  const toggleKind = (id: EntryKind) => {
    setKinds((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]))
  }

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!kinds.length) {
      setError('اختر نوع عملية واحداً على الأقل')
      return
    }
    const range = resolvePeriod(period, day, fromDate, toDate)
    if (period === 'range' && (!range.from || !range.to)) {
      setError('حدد من تاريخ وإلى تاريخ')
      return
    }
    if (period === 'range' && range.from! > range.to!) {
      setError('تاريخ البداية يجب أن يسبق تاريخ النهاية')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const res = await serverApi.offices.statement(officeId, {
        from: range.from,
        to: range.to,
        types: kinds.join(','),
      })
      setRows(res.list ?? [])
      setClosing(res.closingBalance ?? 0)
      setLoaded(true)
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'فشل جلب كشف الحساب')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>كشف الحساب</h1>
        </div>
        <div className="actions">
          <span className="badge badge-info">الرصيد الحالي: {formatMoney(agencyBalance)}</span>
        </div>
      </header>

      <div className="panel">
        <form onSubmit={(e) => void run(e)}>
          <div className="form-grid">
            <div className="field">
              <label>الفترة</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodType)}
              >
                <option value="day">خلال يوم</option>
                <option value="month">خلال شهر</option>
                <option value="range">فترة (من — إلى)</option>
                <option value="until">حتى يوم</option>
              </select>
            </div>

            {(period === 'day' || period === 'month' || period === 'until') && (
              <div className="field">
                <label>
                  {period === 'month' ? 'الشهر' : period === 'until' ? 'حتى تاريخ' : 'اليوم'}
                </label>
                <input
                  type={period === 'month' ? 'month' : 'date'}
                  value={period === 'month' ? day.slice(0, 7) : day}
                  onChange={(e) => {
                    const v = e.target.value
                    setDay(period === 'month' ? `${v}-01` : v)
                  }}
                  required
                />
              </div>
            )}

            {period === 'range' && (
              <>
                <div className="field">
                  <label>من تاريخ</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label>إلى تاريخ</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
          </div>

          <div className="field" style={{ marginTop: '0.75rem' }}>
            <label>نوع القيود</label>
            <div className="actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              {KIND_OPTIONS.map((k) => (
                <label
                  key={k.id}
                  className="badge"
                  style={{
                    cursor: 'pointer',
                    background: kinds.includes(k.id) ? 'var(--amber, #c9842a)' : undefined,
                    color: kinds.includes(k.id) ? '#fff' : undefined,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={kinds.includes(k.id)}
                    onChange={() => toggleKind(k.id)}
                    style={{ marginLeft: '0.35rem' }}
                  />
                  {k.label}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="empty" style={{ color: 'var(--danger)', marginTop: '0.75rem' }}>
              {error}
            </div>
          )}

          <div className="actions" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'جاري العرض…' : 'عرض الكشف'}
            </button>
          </div>
        </form>
      </div>

      {loaded && (
        <>
          <div className="stats">
            <div className="stat">
              <div className="stat-label">إجمالي المدين</div>
              <div className="stat-value" style={{ fontSize: '1.1rem' }}>
                {formatMoney(totals.debit)}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">إجمالي الدائن</div>
              <div className="stat-value" style={{ fontSize: '1.1rem' }}>
                {formatMoney(totals.credit)}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">الرصيد في نهاية الفترة</div>
              <div className="stat-value" style={{ fontSize: '1.1rem' }}>
                {formatMoney(closing)}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>حركات القيود — {currentOffice?.name}</h2>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>النوع</th>
                    <th>البيان</th>
                    <th>مدين</th>
                    <th>دائن</th>
                    <th>الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty">
                        لا توجد قيود في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={`${r.reference_type}-${r.id}`}>
                        <td>{r.journal_date}</td>
                        <td>
                          <span
                            className={`badge ${
                              r.reference_type === 'booking'
                                ? 'badge-info'
                                : r.reference_type === 'booking_commission'
                                  ? 'badge-warn'
                                  : r.reference_type === 'opening'
                                    ? 'badge-ok'
                                    : 'badge-ok'
                            }`}
                          >
                            {r.entry_label}
                          </span>
                        </td>
                        <td>{r.notes || '—'}</td>
                        <td>{r.debit ? formatMoney(r.debit) : '—'}</td>
                        <td>{r.credit ? formatMoney(r.credit) : '—'}</td>
                        <td>{formatMoney(r.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
