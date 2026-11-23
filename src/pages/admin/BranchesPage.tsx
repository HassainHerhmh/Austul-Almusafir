import { useEffect, useMemo, useState } from 'react'
import { serverApi } from '../../api/serverApi'
import { useApp } from '../../context/AppContext'
import type { Branch, BranchStatus } from '../../types'

type SubAccount = {
  id: number
  code: string
  name_ar: string
}

const empty: Omit<Branch, 'id' | 'createdAt' | 'officeCount'> = {
  name: '',
  city: '',
  phone: '',
  status: 'active',
  ledgerAccountId: null,
  commissionPercent: 0,
}

export function BranchesPage() {
  const { state, upsertBranch } = useApp()
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

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    await upsertBranch(editId ? { ...form, id: editId } : form)
    setForm(empty)
    setEditId(null)
    setOpen(false)
  }

  const openModal = async (branch?: Branch) => {
    await loadSubAccounts()
    if (branch) {
      setEditId(branch.id)
      setForm({
        name: branch.name,
        city: branch.city,
        phone: branch.phone,
        status: branch.status,
        ledgerAccountId: branch.ledgerAccountId,
        commissionPercent: branch.commissionPercent ?? 0,
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

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>إدارة الفروع</h1>
          <p>كل فرع يمكن ربط مكاتب تحته وحساب ذمّة مستقل. الرحلات تبقى مركزية عند الوكالة.</p>
        </div>
        <button type="button" className="btn btn-amber" onClick={() => void openModal()}>
          إضافة فرع
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
                <th>المكاتب</th>
                <th>الحالة</th>
                <th>حساب محاسبي</th>
                <th>عمولة افتراضية %</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.branches.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{b.city || '—'}</td>
                  <td>{b.phone || '—'}</td>
                  <td>{b.officeCount ?? '—'}</td>
                  <td>
                    <span className={`badge ${b.status === 'active' ? 'badge-ok' : 'badge-danger'}`}>
                      {b.status === 'active' ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td>{accountLabel(b.ledgerAccountId)}</td>
                  <td>{Number(b.commissionPercent || 0)}%</td>
                  <td>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => void openModal(b)}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() =>
                          void upsertBranch({
                            ...b,
                            status: b.status === 'active' ? 'suspended' : 'active',
                          })
                        }
                      >
                        {b.status === 'active' ? 'إيقاف' : 'تفعيل'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {state.branches.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    لا توجد فروع بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? 'تعديل فرع' : 'فرع جديد'}</h2>
            <form onSubmit={(e) => void save(e)}>
              <div className="form-grid">
                <div className="field">
                  <label>اسم الفرع</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>المدينة</label>
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>الهاتف</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>الحالة</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as BranchStatus })}
                  >
                    <option value="active">نشط</option>
                    <option value="suspended">موقوف</option>
                  </select>
                </div>
                <div className="field">
                  <label>حساب ذمة الفرع</label>
                  <select
                    value={form.ledgerAccountId ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        ledgerAccountId: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  >
                    <option value="">— غير مربوط —</option>
                    {subAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name_ar}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>عمولة افتراضية للمكاتب الجديدة %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.commissionPercent}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        commissionPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                      })
                    }
                  />
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