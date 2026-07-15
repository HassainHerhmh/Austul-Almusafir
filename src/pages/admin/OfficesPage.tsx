import { useEffect, useMemo, useState } from 'react'
import { serverApi } from '../../api/serverApi'
import { useApp } from '../../context/AppContext'
import type { Office, OfficeStatus, SubscriptionStatus } from '../../types'

type SubAccount = {
  id: number
  code: string
  name_ar: string
}

const empty: Omit<Office, 'id' | 'createdAt'> = {
  name: '',
  city: '',
  phone: '',
  status: 'active',
  subscription: 'trial',
  ledgerAccountId: null,
  commissionPercent: 0,
}

export function OfficesPage() {
  const { state, upsertOffice } = useApp()
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([])

  const loadSubAccounts = async () => {
    try {
      const res = await serverApi.accounts.sub()
      const rows = (res.list ?? []).map((a) => ({
        id: a.id,
        code: a.code,
        name_ar: a.name_ar,
      }))
      setSubAccounts(rows.sort((a, b) => a.code.localeCompare(b.code, 'ar')))
    } catch {
      setSubAccounts([])
    }
  }

  useEffect(() => {
    void loadSubAccounts()
  }, [])

  const accountById = useMemo(() => {
    const map = new Map<number, SubAccount>()
    subAccounts.forEach((a) => map.set(a.id, a))
    return map
  }, [subAccounts])

  /** حسابات ذمم المكاتب (فرعية تحت 1131) مع إبقاء باقي الفرعي في الأسفل */
  const officeAccounts = useMemo(
    () =>
      subAccounts.filter(
        (a) =>
          (a.code.startsWith('1131') && a.code.length > 4) ||
          (a.name_ar.includes('مكتب') && a.code !== '53' && !a.name_ar.includes('عمولات')),
      ),
    [subAccounts],
  )

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    await upsertOffice(editId ? { ...form, id: editId } : form)
    setForm(empty)
    setEditId(null)
    setOpen(false)
  }

  const openModal = async (office?: Office) => {
    await loadSubAccounts()
    if (office) {
      setEditId(office.id)
      setForm({
        name: office.name,
        city: office.city,
        phone: office.phone,
        status: office.status,
        subscription: office.subscription,
        ledgerAccountId: office.ledgerAccountId,
        commissionPercent: office.commissionPercent ?? 0,
      })
    } else {
      setEditId(null)
      setForm(empty)
    }
    setOpen(true)
  }

  const accountLabel = (id: number | null) => {
    if (id == null) return '—'
    const a = accountById.get(id)
    return a ? `${a.code} — ${a.name_ar}` : `#${id}`
  }

  const accountOptions =
    officeAccounts.length > 0
      ? [
          ...officeAccounts,
          ...subAccounts.filter((a) => !officeAccounts.some((o) => o.id === a.id)),
        ]
      : subAccounts

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>إدارة المكاتب</h1>
          <p>إضافة وتعديل المكاتب والحساب المحاسبي ونسبة العمولة لكل مكتب</p>
        </div>
        <button type="button" className="btn btn-amber" onClick={() => void openModal()}>
          إضافة مكتب
        </button>
      </header>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>المدينة</th>
                <th>الهاتف</th>
                <th>الحالة</th>
                <th>الاشتراك</th>
                <th>حساب محاسبي</th>
                <th>العمولة %</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.offices.map((o) => (
                <tr key={o.id}>
                  <td>{o.name}</td>
                  <td>{o.city}</td>
                  <td>{o.phone}</td>
                  <td>
                    <span className={`badge ${o.status === 'active' ? 'badge-ok' : 'badge-danger'}`}>
                      {o.status === 'active' ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-info">
                      {o.subscription === 'active'
                        ? 'فعال'
                        : o.subscription === 'trial'
                          ? 'تجريبي'
                          : 'منتهي'}
                    </span>
                  </td>
                  <td>{accountLabel(o.ledgerAccountId)}</td>
                  <td>{Number(o.commissionPercent || 0)}%</td>
                  <td>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => void openModal(o)}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() =>
                          void upsertOffice({
                            ...o,
                            status: o.status === 'active' ? 'suspended' : 'active',
                          })
                        }
                      >
                        {o.status === 'active' ? 'إيقاف' : 'تفعيل'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? 'تعديل مكتب' : 'مكتب جديد'}</h2>
            <form onSubmit={(e) => void save(e)}>
              <div className="form-grid">
                <div className="field">
                  <label>اسم المكتب</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>المدينة</label>
                  <input
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>الهاتف</label>
                  <input
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>الحالة</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as OfficeStatus })}
                  >
                    <option value="active">نشط</option>
                    <option value="suspended">موقوف</option>
                  </select>
                </div>
                <div className="field">
                  <label>الاشتراك</label>
                  <select
                    value={form.subscription}
                    onChange={(e) =>
                      setForm({ ...form, subscription: e.target.value as SubscriptionStatus })
                    }
                  >
                    <option value="active">فعال</option>
                    <option value="trial">تجريبي</option>
                    <option value="expired">منتهي</option>
                  </select>
                </div>
                <div className="field">
                  <label>الحساب المحاسبي للمكتب</label>
                  <select
                    value={form.ledgerAccountId ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        ledgerAccountId: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  >
                    <option value="">— يُنشأ تلقائياً تحت ذمم المكاتب —</option>
                    {accountOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name_ar}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>نسبة العمولة %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    required
                    value={form.commissionPercent}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        commissionPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                      })
                    }
                  />
                  <p className="field-hint">
                    تُحسب من سعر التذكرة وتُقيَّد من مصروف عمولات المكاتب إلى حساب المكتب
                  </p>
                </div>
              </div>
              <div className="actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">
                  حفظ
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
