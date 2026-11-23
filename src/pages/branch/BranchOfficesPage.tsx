import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { Office, OfficeStatus, SubscriptionStatus } from '../../types'

const emptyBase = {
  name: '',
  city: '',
  phone: '',
  status: 'active' as OfficeStatus,
  subscription: 'trial' as SubscriptionStatus,
  ledgerAccountId: null as number | null,
  commissionPercent: 0,
}

export function BranchOfficesPage() {
  const { state, currentBranch, upsertOffice } = useApp()
  const offices = useMemo(
    () => state.offices.filter((o) => o.branchId === currentBranch?.id),
    [state.offices, currentBranch?.id],
  )
  const [form, setForm] = useState({ ...emptyBase })
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentBranch) return
    const payload = {
      ...form,
      branchId: currentBranch.id,
      commissionPercent: form.commissionPercent || currentBranch.commissionPercent || 0,
    }
    await upsertOffice(editId ? { ...payload, id: editId } : payload)
    setForm({ ...emptyBase })
    setEditId(null)
    setOpen(false)
  }

  const openModal = (office?: Office) => {
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
      setForm({
        ...emptyBase,
        commissionPercent: currentBranch?.commissionPercent ?? 0,
      })
    }
    setOpen(true)
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>مكاتب الفرع</h1>
        </div>
        <button type="button" className="btn btn-amber" onClick={() => openModal()}>
          مكتب جديد
        </button>
      </header>
      <div className="panel">
        <OfficesTable offices={offices} onEdit={openModal} onToggle={upsertOffice} />
      </div>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? 'تعديل مكتب' : 'مكتب جديد'}</h2>
            <form onSubmit={(e) => void save(e)}>
              <OfficeFormFields form={form} setForm={setForm} />
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

function OfficesTable({
  offices,
  onEdit,
  onToggle,
}: {
  offices: Office[]
  onEdit: (o: Office) => void
  onToggle: (o: Office & { id: string }) => Promise<void>
}) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>الاسم</th>
            <th>المدينة</th>
            <th>الهاتف</th>
            <th>الحالة</th>
            <th>العمولة %</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {offices.map((o) => (
            <tr key={o.id}>
              <td>{o.name}</td>
              <td>{o.city}</td>
              <td>{o.phone}</td>
              <td>
                <span className={`badge ${o.status === 'active' ? 'badge-ok' : 'badge-danger'}`}>
                  {o.status === 'active' ? 'نشط' : 'موقوف'}
                </span>
              </td>
              <td>{Number(o.commissionPercent || 0)}%</td>
              <td>
                <div className="actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(o)}>
                    تعديل
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() =>
                      void onToggle({
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
          {offices.length === 0 && (
            <tr>
              <td colSpan={6} className="empty">
                لا توجد مكاتب بعد
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function OfficeFormFields({
  form,
  setForm,
}: {
  form: typeof emptyBase
  setForm: (f: typeof emptyBase) => void
}) {
  return (
    <div className="form-grid">
      <div className="field">
        <label>اسم المكتب</label>
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="field">
        <label>المدينة</label>
        <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
      </div>
      <div className="field">
        <label>الهاتف</label>
        <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="field">
        <label>نسبة العمولة %</label>
        <input
          type="number"
          min={0}
          max={100}
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
  )
}