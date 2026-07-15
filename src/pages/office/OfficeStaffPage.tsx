import { useState } from 'react'
import { ROLE_LABELS } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import type { Role } from '../../types'

export function OfficeStaffPage() {
  const { state, currentOffice, currentUser, can, upsertUser, deleteUser } = useApp()
  const officeId = currentOffice!.id

  const staff = state.users.filter((u) => u.officeId === officeId)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '123456',
    role: 'booking_clerk' as Role,
  })

  if (!can('manage_office_users')) {
    return (
      <div className="panel">
        <div className="empty">فقط مدير المكتب يمكنه إدارة الموظفين</div>
      </div>
    )
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.role === 'admin') return
    upsertUser({
      ...form,
      officeId,
      active: true,
    })
    setOpen(false)
    setForm({ name: '', username: '', password: '123456', role: 'booking_clerk' })
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>موظفو المكتب</h1>
          <p>
            صلاحيات الحجز والطباعة والمحاسبة — مثال: موظف الحجز لا يحذف، المحاسب لا ينشئ رحلات
          </p>
        </div>
        <button type="button" className="btn btn-amber" onClick={() => setOpen(true)}>
          إضافة موظف
        </button>
      </header>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>اسم المستخدم</th>
                <th>الدور</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.username}</td>
                  <td>{ROLE_LABELS[u.role]}</td>
                  <td>
                    <span className={`badge ${u.active ? 'badge-ok' : 'badge-danger'}`}>
                      {u.active ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td>
                    {u.id !== currentUser?.id && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (confirm('حذف الموظف؟')) deleteUser(u.id)
                        }}
                      >
                        حذف
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>مرجع الصلاحيات</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الدور</th>
                <th>يستطيع</th>
                <th>لا يستطيع</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>موظف الحجز</td>
                <td>الحجز · الطباعة</td>
                <td>حذف الحجوزات · الحسابات</td>
              </tr>
              <tr>
                <td>المحاسب</td>
                <td>الحسابات · التقارير · الصندوق</td>
                <td>إنشاء حجوزات أو رحلات</td>
              </tr>
              <tr>
                <td>مدير المكتب</td>
                <td>كل صلاحيات المكتب</td>
                <td>إدارة النظام المركزي</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>موظف جديد</h2>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="field">
                  <label>الاسم</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>اسم المستخدم</label>
                  <input
                    required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>كلمة المرور</label>
                  <input
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>الدور</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  >
                    <option value="office_manager">مدير مكتب</option>
                    <option value="booking_clerk">موظف حجز</option>
                    <option value="accountant">محاسب</option>
                  </select>
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
