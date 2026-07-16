import { useState } from 'react'
import { useApp } from '../../context/AppContext'

export function VisaTypesPage() {
  const { state, upsertVisaType, deleteVisaType } = useApp()
  const [name, setName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setEditId(null)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await upsertVisaType(editId ? { id: editId, name: name.trim() } : { name: name.trim() })
    resetForm()
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>أنواع التأشيرات</h1>
          <p>قائمة أنواع التأشيرة التي تظهر عند الحجز</p>
        </div>
      </header>

      <div className="panel">
        <form onSubmit={(e) => void save(e)} className="actions" style={{ marginBottom: '1rem' }}>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label>{editId ? 'تعديل نوع التأشيرة' : 'نوع تأشيرة جديد'}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="مثال: زيارة · عمرة · عمل"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>
            {editId ? 'تحديث' : 'إضافة'}
          </button>
          {editId && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ alignSelf: 'flex-end' }}
              onClick={resetForm}
            >
              إلغاء
            </button>
          )}
        </form>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>نوع التأشيرة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.visaTypes.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditId(v.id)
                          setName(v.name)
                        }}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (confirm(`حذف «${v.name}»؟`)) void deleteVisaType(v.id)
                        }}
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {state.visaTypes.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty">
                    لا توجد أنواع تأشيرات بعد — أضف أنواعاً من الأعلى
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
