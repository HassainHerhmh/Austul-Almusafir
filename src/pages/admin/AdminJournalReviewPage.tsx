import { useMemo, useState } from 'react'
import { formatMoney, todayStr } from '../../components/utils'
import { serverApi } from '../../api/serverApi'
import { useApp } from '../../context/AppContext'

type PeriodType = 'day' | 'month' | 'range' | 'until'

type JournalRow = {
  id: number
  journal_date: string
  account_id: number
  account_code: string
  account_name: string
  debit: number
  credit: number
  notes: string | null
  reference_type: string
  reference_id: number
  entry_label: string
  created_at: string
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

export function AdminJournalReviewPage() {
  const { state } = useApp()
  const today = todayStr()

  const [period, setPeriod] = useState<PeriodType>('day')
  const [day, setDay] = useState(today)
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [officeId, setOfficeId] = useState('')
  const [rows, setRows] = useState<JournalRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const officeLedgerId = useMemo(() => {
    if (!officeId) return null
    const office = state.offices.find((o) => o.id === officeId)
    return office?.ledgerAccountId ?? null
  }, [officeId, state.offices])

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + r.debit, 0)
    const credit = rows.reduce((s, r) => s + r.credit, 0)
    return { debit, credit, count: rows.length }
  }, [rows])

  const byType = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach((r) => {
      map.set(r.entry_label, (map.get(r.entry_label) || 0) + 1)
    })
    return [...map.entries()]
  }, [rows])

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const range = resolvePeriod(period, day, fromDate, toDate)
    if (period === 'range' && (!range.from || !range.to)) {
      setError('حدد من تاريخ وإلى تاريخ')
      return
    }
    if (period === 'range' && range.from! > range.to!) {
      setError('تاريخ البداية يجب أن يسبق تاريخ النهاية')
      return
    }
    if (officeId && !officeLedgerId) {
      setError('هذا المكتب ليس له حساب محاسبي مربوط')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const res = await serverApi.accounts.journalLines({
        from: range.from,
        to: range.to,
        accountId: officeLedgerId,
      })
      setRows(res.list ?? [])
      setLoaded(true)
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'فشل جلب القيود')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h2 className="acc-heading text-xl">مراجعة القيود</h2>
        </div>
      </header>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6 }}>
          هذه الصفحة تعرض القيود الفعلية من قاعدة البيانات (نفس مصدر كشف حساب الوكيل). كشف
          الحساب داخل وحدة الحسابات كان يجلب حسابات محلية قديمة — لذلك قد تظهر حسابات غير موجودة
          في التهيئة.
        </p>
      </div>

      <div className="panel">
        <form onSubmit={(e) => void run(e)}>
          <div className="form-grid">
            <div className="field">
              <label>الفترة</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodType)}>
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

            <div className="field">
              <label>المكتب (اختياري)</label>
              <select value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
                <option value="">كل القيود</option>
                {state.offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.ledgerAccountId ? '' : ' — بلا حساب'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="empty" style={{ color: 'var(--danger)', marginTop: '0.75rem' }}>
              {error}
            </div>
          )}

          <div className="actions" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'جاري العرض…' : 'عرض القيود'}
            </button>
          </div>
        </form>
      </div>

      {loaded && (
        <>
          <div className="stats">
            <div className="stat">
              <div className="stat-label">عدد الأسطر</div>
              <div className="stat-value">{totals.count}</div>
            </div>
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
          </div>

          {byType.length > 0 && (
            <div className="actions" style={{ marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {byType.map(([label, n]) => (
                <span key={label} className="badge badge-info">
                  {label}: {n}
                </span>
              ))}
            </div>
          )}

          <div className="panel">
            <div className="panel-head">
              <h2>قيود اليومية من قاعدة البيانات</h2>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>النوع</th>
                    <th>الحساب</th>
                    <th>البيان</th>
                    <th>مدين</th>
                    <th>دائن</th>
                    <th>مرجع</th>
                    <th>وقت التسجيل</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty">
                        لا توجد قيود في هذه الفترة — إن ظهرت عند الوكيل فتحقق من المكتب والفترة
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.journal_date}</td>
                        <td>
                          <span
                            className={`badge ${
                              r.reference_type === 'booking'
                                ? 'badge-info'
                                : r.reference_type === 'booking_commission'
                                  ? 'badge-warn'
                                  : 'badge-ok'
                            }`}
                          >
                            {r.entry_label}
                          </span>
                        </td>
                        <td>
                          {r.account_code} — {r.account_name}
                        </td>
                        <td>{r.notes || '—'}</td>
                        <td>{r.debit ? formatMoney(r.debit) : '—'}</td>
                        <td>{r.credit ? formatMoney(r.credit) : '—'}</td>
                        <td>
                          {r.reference_type}/{r.reference_id}
                        </td>
                        <td>{r.created_at.slice(0, 19).replace('T', ' ')}</td>
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
