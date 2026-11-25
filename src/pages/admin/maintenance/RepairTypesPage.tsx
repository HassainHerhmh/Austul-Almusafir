import { useCallback, useEffect, useState } from 'react'
import { serverApi } from '../../../api/serverApi'

type Row = { id: string; name: string }

export function RepairTypesPage() {
  const [list, setList] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await serverApi.maintenance.repairTypes.list()
    setList(res.list ?? [])
  }, [])

  useEffect(() => {
    void load().catch(() => setList([]))
  }, [load])

  const reset = () => {
    setEditId(null)
    setName('')
    setErr(null)
  }

  const startAdd = () => {
    reset()
    setOpen(true)
  }

  const startEdit = (row: Row) => {
    setEditId(row.id)
    setName(row.name)
    setErr(null)
    setOpen(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setErr(null)
    try {
      if (editId) {
        await serverApi.maintenance.repairTypes.update(editId, { name: name.trim() })
      } else {
        await serverApi.maintenance.repairTypes.create({ name: name.trim() })
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

  const remove = async (row: Row) => {
    if (!confirm(`حذف نوع «${row.name}»؟`)) return
    try {
      await serverApi.maintenance.repairTypes.remove(row.id)
      await load()
    } catch (ex) {
      alert(ex instanceof Error ? ex.message : 'فشل الحذف')
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h2>أنواع الإصلاحات</h2>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-amber" onClick={startAdd}>
            إضافة نوع
          </button>
        </div>
      </header>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>نوع الإصلاح</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
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
              {list.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty">
                    لا توجد أنواع — اضغط «إضافة نوع»
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
            <h2>{editId ? 'تعديل نوع إصلاح' : 'نوع إصلاح جديد'}</h2>
            {err && <p className="error-msg">{err}</p>}
            <form onSubmit={(e) => void save(e)}>
              <div className="field">
                <label>اسم النوع</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="مثال: تغيير زيت"
                  autoFocus
                />
              </div>
              <div className="actions" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'جاري الحفظ…' : 'حفظ'}
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