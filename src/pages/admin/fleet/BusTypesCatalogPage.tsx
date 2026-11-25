import { useCallback, useEffect, useState } from 'react'
import { serverApi } from '../../../api/serverApi'

type Row = { id: string; name: string }

export function BusTypesCatalogPage() {
  const [list, setList] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await serverApi.busTypes.list()
    setList((res.list ?? []).map((r: any) => ({ id: r.id, name: r.name })))
  }, [])

  useEffect(() => {
    void load().catch(() => setList([]))
  }, [load])

  const reset = () => {
    setEditId(null)
    setName('')
    setErr(null)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setErr(null)
    try {
      if (editId) {
        await serverApi.busTypes.update(editId, { name: name.trim() })
      } else {
        await serverApi.busTypes.create({ name: name.trim() })
      }
      setOpen(false)
      reset()
      await load()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'فشل الحفظ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h2>أنواع الحافلات</h2>
        </div>
        <button type="button" className="btn btn-amber" onClick={() => { reset(); setOpen(true) }}>
          إضافة نوع
        </button>
      </header>
      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>النوع</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditId(row.id)
                          setName(row.name)
                          setOpen(true)
                        }}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (confirm(`حذف «${row.name}»؟`))
                            void serverApi.busTypes.remove(row.id).then(load)
                        }}
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty">
                    لا توجد بيانات
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
            <h2>{editId ? 'تعديل نوع' : 'نوع جديد'}</h2>
            {err && <p className="error-msg">{err}</p>}
            <form onSubmit={(e) => void save(e)}>
              <div className="field">
                <label>اسم النوع</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </div>
              <div className="actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
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