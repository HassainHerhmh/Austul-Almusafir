import { useRef, useState } from 'react'
import { DRIVER_ROLE_LABELS } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import type { Driver, DriverRole } from '../../types'
import {
  downloadExcel,
  exportTablePdf,
  pick,
  readExcelRows,
} from '../../utils/importExport'

const empty = {
  name: '',
  phone: '',
  licenseNumber: '',
  nationality: '',
  role: 'primary' as DriverRole,
  active: true,
}

function parseRole(v: string): DriverRole {
  const s = v.trim()
  if (s === 'معاون' || s === 'assistant') return 'assistant'
  return 'primary'
}

function parseActive(v: string): boolean {
  const s = v.trim()
  if (s === 'موقوف' || s === '0' || s === 'false' || s === 'لا') return false
  return true
}

export function DriversPage() {
  const { state, upsertDriver } = useApp()
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    upsertDriver(editId ? { ...form, id: editId } : form)
    setOpen(false)
    setForm(empty)
    setEditId(null)
  }

  const startEdit = (d: Driver) => {
    setEditId(d.id)
    setForm({
      name: d.name,
      phone: d.phone,
      licenseNumber: d.licenseNumber,
      nationality: d.nationality || '',
      role: d.role,
      active: d.active,
    })
    setOpen(true)
  }

  const exportExcel = () => {
    downloadExcel(
      'السائقون.xlsx',
      state.drivers.map((d) => ({
        الاسم: d.name,
        الهاتف: d.phone,
        'رقم الهوية': d.licenseNumber,
        الجنسية: d.nationality || '',
        النوع: DRIVER_ROLE_LABELS[d.role],
        الحالة: d.active ? 'نشط' : 'موقوف',
      })),
    )
  }

  const exportPdf = () => {
    exportTablePdf(
      'قائمة السائقين',
      ['الاسم', 'الهاتف', 'رقم الهوية', 'الجنسية', 'النوع', 'الحالة'],
      state.drivers.map((d) => [
        d.name,
        d.phone,
        d.licenseNumber,
        d.nationality || '—',
        DRIVER_ROLE_LABELS[d.role],
        d.active ? 'نشط' : 'موقوف',
      ]),
    )
  }

  const downloadTemplate = () => {
    downloadExcel('نموذج_استيراد_سائقين.xlsx', [
      {
        الاسم: 'أحمد علي',
        الهاتف: '777000111',
        'رقم الهوية': '1234567890',
        الجنسية: 'يمني',
        النوع: 'رسمي',
        الحالة: 'نشط',
      },
    ])
  }

  const importExcel = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    setImportMsg(null)
    try {
      const rows = await readExcelRows(file)
      let ok = 0
      let skipped = 0
      const byIdCard = new Map(state.drivers.map((d) => [d.licenseNumber, d.id]))
      for (const row of rows) {
        const name = pick(row, ['الاسم', 'name', 'Name'])
        const phone = pick(row, ['الهاتف', 'phone', 'Phone'])
        const licenseNumber = pick(row, [
          'رقم الهوية',
          'رقم الرخصة',
          'الهوية',
          'licenseNumber',
          'nationalId',
        ])
        if (!name || !phone || !licenseNumber) {
          skipped++
          continue
        }
        const nationality = pick(row, ['الجنسية', 'nationality', 'Nationality'])
        const role = parseRole(pick(row, ['النوع', 'role', 'Role']))
        const active = parseActive(pick(row, ['الحالة', 'active', 'Active']) || 'نشط')
        const existingId =
          byIdCard.get(licenseNumber) ||
          state.drivers.find((d) => d.phone === phone && d.name === name)?.id
        const saved = await upsertDriver({
          ...(existingId ? { id: existingId } : {}),
          name,
          phone,
          licenseNumber,
          nationality,
          role,
          active,
        })
        byIdCard.set(licenseNumber, saved.id)
        ok++
      }
      setImportMsg(`تم استيراد ${ok} سائق${skipped ? ` · تخطي ${skipped}` : ''}`)
    } catch {
      setImportMsg('فشل قراءة ملف Excel')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>إدارة السائقين</h1>
          <p>سائق رسمي أو معاون — رقم الهوية والجنسية · استيراد وتصدير Excel</p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={downloadTemplate}>
            نموذج Excel
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            استيراد Excel
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(e) => void importExcel(e.target.files?.[0] ?? null)}
          />
          <button type="button" className="btn btn-ghost" onClick={exportExcel} disabled={!state.drivers.length}>
            تصدير Excel
          </button>
          <button type="button" className="btn btn-ghost" onClick={exportPdf} disabled={!state.drivers.length}>
            تصدير PDF
          </button>
          <button
            type="button"
            className="btn btn-amber"
            onClick={() => {
              setEditId(null)
              setForm(empty)
              setOpen(true)
            }}
          >
            إضافة سائق
          </button>
        </div>
      </header>

      {importMsg && <p className="success-msg" style={{ marginBottom: '0.75rem' }}>{importMsg}{busy ? '…' : ''}</p>}

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th>رقم الهوية</th>
                <th>الجنسية</th>
                <th>النوع</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.drivers.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{d.phone}</td>
                  <td>{d.licenseNumber}</td>
                  <td>{d.nationality || '—'}</td>
                  <td>
                    <span
                      className={`badge ${d.role === 'primary' ? 'badge-info' : 'badge-warn'}`}
                    >
                      {DRIVER_ROLE_LABELS[d.role]}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${d.active ? 'badge-ok' : 'badge-danger'}`}>
                      {d.active ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => startEdit(d)}
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

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? 'تعديل سائق' : 'سائق جديد'}</h2>
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
                  <label>الهاتف</label>
                  <input
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>رقم الهوية</label>
                  <input
                    required
                    value={form.licenseNumber}
                    onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>الجنسية</label>
                  <input
                    required
                    value={form.nationality}
                    onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                    placeholder="مثال: يمني"
                  />
                </div>
                <div className="field">
                  <label>النوع</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as DriverRole })}
                  >
                    <option value="primary">رسمي</option>
                    <option value="assistant">معاون</option>
                  </select>
                </div>
                <div className="field">
                  <label>الحالة</label>
                  <select
                    value={form.active ? '1' : '0'}
                    onChange={(e) => setForm({ ...form, active: e.target.value === '1' })}
                  >
                    <option value="1">نشط</option>
                    <option value="0">موقوف</option>
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
