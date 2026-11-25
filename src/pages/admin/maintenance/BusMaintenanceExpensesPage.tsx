import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { serverApi } from '../../../api/serverApi'
import { useApp } from '../../../context/AppContext'
import { formatMoney, todayStr } from '../../../components/utils'
import { downloadExcel } from '../../../utils/importExport'

type ExpenseRow = {
  id: string
  busId: string
  repairTypeId: string
  maintenanceDate: string
  costBeforeDiscount: number
  discountType: string
  discountValue: number
  finalCost: number
  notes: string
  creditAccountId: number | null
  busPlate: string
  busNumber: string
  repairTypeName: string
}

type AccountOpt = { id: number; code: string; name_ar: string }

const discountLabels: Record<string, string> = {
  none: '—',
  percent: 'نسبة %',
  fixed: 'مبلغ ثابت',
}

function computeLocalFinal(before: number, discountType: string, discountValue: number) {
  if (discountType === 'percent') {
    const pct = Math.min(100, Math.max(0, discountValue))
    return Math.max(0, before * (1 - pct / 100))
  }
  if (discountType === 'fixed') return Math.max(0, before - discountValue)
  return before
}

const emptyForm = () => ({
  busId: '',
  repairTypeId: '',
  maintenanceDate: todayStr(),
  costBeforeDiscount: 0,
  discountType: 'none' as 'none' | 'percent' | 'fixed',
  discountValue: 0,
  notes: '',
  creditAccountId: '' as number | '',
})

export function BusMaintenanceExpensesPage() {
  const { state } = useApp()
  const [list, setList] = useState<ExpenseRow[]>([])
  const [repairTypes, setRepairTypes] = useState<{ id: string; name: string }[]>([])
  const [accounts, setAccounts] = useState<AccountOpt[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [expRes, typesRes] = await Promise.all([
      serverApi.maintenance.expenses.list(),
      serverApi.maintenance.repairTypes.list(),
    ])
    setList(expRes.list ?? [])
    setRepairTypes((typesRes.list ?? []).map((t: any) => ({ id: t.id, name: t.name })))
  }, [])

  useEffect(() => {
    void load().catch(() => setList([]))
    void serverApi.accounts
      .sub()
      .then((res) => {
        const rows = (res.list ?? []).map((a: any) => ({
          id: a.id,
          code: a.code ?? '',
          name_ar: a.name_ar ?? a.nameAr ?? '',
        }))
        setAccounts(rows)
      })
      .catch(() => setAccounts([]))
  }, [load])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return list
    return list.filter((row) => {
      const hay =
        `${row.busPlate} ${row.busNumber} ${row.repairTypeName} ${row.notes}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [list, q])

  const previewFinal = computeLocalFinal(form.costBeforeDiscount, form.discountType, form.discountValue)

  const reset = () => {
    setEditId(null)
    setForm(emptyForm())
    setErr(null)
  }

  const startAdd = () => {
    reset()
    setOpen(true)
  }

  const startEdit = (row: ExpenseRow) => {
    setEditId(row.id)
    setForm({
      busId: row.busId,
      repairTypeId: row.repairTypeId,
      maintenanceDate: row.maintenanceDate,
      costBeforeDiscount: row.costBeforeDiscount,
      discountType: (row.discountType as 'none' | 'percent' | 'fixed') || 'none',
      discountValue: row.discountValue,
      notes: row.notes,
      creditAccountId: row.creditAccountId ?? '',
    })
    setErr(null)
    setOpen(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.busId || !form.repairTypeId) return
    setBusy(true)
    setErr(null)
    const payload = {
      busId: form.busId,
      repairTypeId: form.repairTypeId,
      maintenanceDate: form.maintenanceDate,
      costBeforeDiscount: form.costBeforeDiscount,
      discountType: form.discountType,
      discountValue: form.discountValue,
      notes: form.notes,
      creditAccountId: form.creditAccountId === '' ? null : Number(form.creditAccountId),
    }
    try {
      if (editId) {
        await serverApi.maintenance.expenses.update(editId, payload)
      } else {
        await serverApi.maintenance.expenses.create(payload)
      }
      setOpen(false)
      reset()
      await load()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'فشل الحفظ — تأكد من حساب الوسيط في الحسابات الوسيطة')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: ExpenseRow) => {
    if (!confirm('حذف سجل الصيانة والقيد المحاسبي المرتبط؟')) return
    try {
      await serverApi.maintenance.expenses.remove(row.id)
      await load()
    } catch (ex) {
      alert(ex instanceof Error ? ex.message : 'فشل الحذف')
    }
  }

  const exportRows = () => {
    downloadExcel(
      `صيانات_حافلات_${todayStr()}.xlsx`,
      filtered.map((row) => ({
        الحافلة: row.busPlate,
        'رقم الحافلة': row.busNumber || '—',
        'نوع الصيانة': row.repairTypeName,
        التاريخ: row.maintenanceDate,
        'التكلفة قبل الخصم': row.costBeforeDiscount,
        'نوع الخصم': discountLabels[row.discountType] ?? row.discountType,
        'قيمة الخصم': row.discountValue,
        'التكلفة النهائية': row.finalCost,
        ملاحظات: row.notes,
      })),
    )
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h2>مصاريف صيانات الحافلات</h2>
          <p className="text-muted" style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
            يُرحَّل المبلغ تلقائياً: مدين حساب وسيط الصيانات · دائن حساب الصرف المختار
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={exportRows} disabled={!filtered.length}>
            تصدير الصيانات
          </button>
          <button type="button" className="btn btn-amber" onClick={startAdd}>
            إضافة صيانة
          </button>
        </div>
      </header>

      <div className="panel">
        <div className="maintenance-toolbar">
          <div className="field maintenance-search">
            <Search size={18} aria-hidden className="search-icon" />
            <input
              type="search"
              placeholder="بحث بالحافلة أو النوع أو الملاحظات…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="data maintenance-expenses-table">
            <thead>
              <tr>
                <th>الحافلة</th>
                <th>نوع الصيانة</th>
                <th>التكلفة الإجمالية</th>
                <th>التكلفة قبل الخصم</th>
                <th>نوع الخصم</th>
                <th>قيمة الخصم</th>
                <th>التكلفة النهائية</th>
                <th>ملاحظات</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>{row.busPlate}</td>
                  <td>
                    <span className="badge badge-ok">{row.repairTypeName}</span>
                  </td>
                  <td>{formatMoney(row.finalCost)}</td>
                  <td>{formatMoney(row.costBeforeDiscount)}</td>
                  <td>{discountLabels[row.discountType] ?? '—'}</td>
                  <td>{row.discountType === 'none' ? '—' : row.discountValue}</td>
                  <td>{formatMoney(row.finalCost)}</td>
                  <td className="notes-cell">{row.notes || '—'}</td>
                  <td>
                    <div className="actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(row)}>
                        تعديل
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(row)}>
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    لا توجد سجلات صيانة — اضغط «إضافة صيانة»
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? 'تعديل صيانة' : 'إضافة صيانة'}</h2>
            {err && <p className="error-msg">{err}</p>}
            <form onSubmit={(e) => void save(e)}>
              <div className="form-grid">
                <div className="field">
                  <label>الحافلة</label>
                  <select
                    required
                    value={form.busId}
                    onChange={(e) => setForm({ ...form, busId: e.target.value })}
                  >
                    <option value="">اختر الحافلة</option>
                    {state.buses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.plateNumber}
                        {b.busNumber ? ` — ${b.busNumber}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>نوع الصيانة</label>
                  <select
                    required
                    value={form.repairTypeId}
                    onChange={(e) => setForm({ ...form, repairTypeId: e.target.value })}
                  >
                    <option value="">اختر النوع</option>
                    {repairTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>تاريخ الصيانة</label>
                  <input
                    type="date"
                    required
                    value={form.maintenanceDate}
                    onChange={(e) => setForm({ ...form, maintenanceDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>التكلفة قبل الخصم</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={form.costBeforeDiscount || ''}
                    onChange={(e) =>
                      setForm({ ...form, costBeforeDiscount: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="field">
                  <label>نوع الخصم</label>
                  <select
                    value={form.discountType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        discountType: e.target.value as 'none' | 'percent' | 'fixed',
                      })
                    }
                  >
                    <option value="none">بدون خصم</option>
                    <option value="percent">نسبة مئوية</option>
                    <option value="fixed">مبلغ ثابت</option>
                  </select>
                </div>
                <div className="field">
                  <label>قيمة الخصم</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={form.discountType === 'none'}
                    value={form.discountValue || ''}
                    onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="field">
                  <label>التكلفة النهائية</label>
                  <input readOnly value={formatMoney(previewFinal)} className="readonly-field" />
                </div>
                <div className="field">
                  <label>حساب الصرف (صندوق/بنك)</label>
                  <select
                    value={form.creditAccountId}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        creditAccountId: e.target.value ? Number(e.target.value) : '',
                      })
                    }
                  >
                    <option value="">اختر الحساب</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code ? `${a.code} — ` : ''}
                        {a.name_ar}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>ملاحظات</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="تفاصيل العمل أو القطع المستخدمة"
                  />
                </div>
              </div>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>
                عيّن «وسيط صيانات الحافلات» من الحسابات → التهيئة → الحسابات الوسيطة قبل أول ترحيل.
              </p>
              <div className="actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'جاري الحفظ…' : 'حفظ وترحيل'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
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