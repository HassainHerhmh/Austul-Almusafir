import { useState } from 'react'
import { useApp } from '../../context/AppContext'

export function DestinationsPage() {
  const { state, upsertDestination } = useApp()
  const [name, setName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    upsertDestination(editId ? { id: editId, name: name.trim() } : { name: name.trim() })
    setName('')
    setEditId(null)
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>إدارة الوجهات</h1>
          <p>صنعاء، عدن، تعز، إب، سيئون، المكلا، مارب، الحديدة...</p>
        </div>
      </header>

      <div className="panel">
        <form onSubmit={save} className="actions" style={{ marginBottom: '1rem' }}>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label>{editId ? 'تعديل الوجهة' : 'وجهة جديدة'}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>
            {editId ? 'تحديث' : 'إضافة'}
          </button>
          {editId && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ alignSelf: 'flex-end' }}
              onClick={() => {
                setEditId(null)
                setName('')
              }}
            >
              إلغاء
            </button>
          )}
        </form>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الوجهة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.destinations.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setEditId(d.id)
                        setName(d.name)
                      }}
                    >
                      تعديل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
