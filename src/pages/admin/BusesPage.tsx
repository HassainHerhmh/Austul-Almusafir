import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { Bus, BusStatus } from '../../types'
import {
  downloadExcel,
  exportTablePdf,
  pick,
  readExcelRows,
} from '../../utils/importExport'

const empty = {
  plateNumber: '',
  type: '',
  seats: 50,
  status: 'available' as BusStatus,
}

function parseStatus(v: string): BusStatus {
  const s = v.trim()
  if (s === 'صيانة' || s === 'maintenance') return 'maintenance'
  if (s === 'غير نشط' || s === 'inactive') return 'inactive'
  return 'available'
}

const statusLabel = (s: BusStatus) =>
  s === 'available' ? 'متاح' : s === 'maintenance' ? 'صيانة' : 'غير نشط'

export function BusesPage() {
  const { state, upsertBus } = useApp()
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    upsertBus(editId ? { ...form, id: editId } : form)
    setOpen(false)
    setForm(empty)
    setEditId(null)
  }

  const startEdit = (b: Bus) => {
    setEditId(b.id)
    setForm({
      plateNumber: b.plateNumber,
      type: b.type,
      seats: b.seats,
      status: b.status,
    })
    setOpen(true)
  }

  const exportExcel = () => {
    downloadExcel(
      'الباصات.xlsx',
      state.buses.map((b) => ({
        'رقم اللوحة': b.plateNumber,
        النوع: b.type,
        المقاعد: b.seats,
        الحالة: statusLabel(b.status),
      })),
    )
  }

  const exportPdf = () => {
    exportTablePdf(
      'قائمة الباصات',
      ['رقم اللوحة', 'النوع', 'المقاعد', 'الحالة'],
      state.buses.map((b) => [b.plateNumber, b.type, b.seats, statusLabel(b.status)]),
    )
  }

  const downloadTemplate = () => {
    downloadExcel('نموذج_استيراد_باصات.xlsx', [
      {
        'رقم اللوحة': '22-12345',
        النوع: 'مرسيدس',
        المقاعد: 50,
        الحالة: 'متاح',
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
      const byPlate = new Map(state.buses.map((b) => [b.plateNumber, b.id]))
      for (const row of rows) {
        const plateNumber = pick(row, ['رقم اللوحة', 'اللوحة', 'plateNumber', 'plate'])
        const type = pick(row, ['النوع', 'type', 'Type'])
        const seatsRaw = pick(row, ['المقاعد', 'seats', 'Seats'])
        const seats = Math.max(1, Number(seatsRaw) || 0)
        if (!plateNumber || !type || seats < 1) {
          skipped++
          continue
        }
        const status = parseStatus(pick(row, ['الحالة', 'status', 'Status']) || 'متاح')
        const existingId = byPlate.get(plateNumber)
        const saved = await upsertBus({
          ...(existingId ? { id: existingId } : {}),
          plateNumber,
          type,
          seats,
          status,
        })
        byPlate.set(plateNumber, saved.id)
        ok++
      }
      setImportMsg(`تم استيراد ${ok} باص${skipped ? ` · تخطي ${skipped}` : ''}`)
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
          <h1>إدارة الباصات</h1>
          <p>اللوحات وأنواع الباصات · استيراد وتصدير Excel</p>
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
          <button type="button" className="btn btn-ghost" onClick={exportExcel} disabled={!state.buses.length}>
            تصدير Excel
          </button>
          <button type="button" className="btn btn-ghost" onClick={exportPdf} disabled={!state.buses.length}>
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
            إضافة باص
          </button>
        </div>
      </header>

      {importMsg && <p className="success-msg" style={{ marginBottom: '0.75rem' }}>{importMsg}{busy ? '…' : ''}</p>}

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>رقم اللوحة</th>
                <th>النوع</th>
                <th>المقاعد</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.buses.map((b) => (
                <tr key={b.id}>
                  <td>{b.plateNumber}</td>
                  <td>{b.type}</td>
                  <td>{b.seats}</td>
                  <td>
                    <span
                      className={`badge ${
                        b.status === 'available'
                          ? 'badge-ok'
                          : b.status === 'maintenance'
                            ? 'badge-warn'
                            : 'badge-danger'
                      }`}
                    >
                      {statusLabel(b.status)}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(b)}>
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
            <h2>{editId ? 'تعديل باص' : 'باص جديد'}</h2>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="field">
                  <label>رقم اللوحة</label>
                  <input
                    required
                    value={form.plateNumber}
                    onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>النوع</label>
                  <input
                    required
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>عدد المقاعد</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.seats}
                    onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label>الحالة</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as BusStatus })}
                  >
                    <option value="available">متاح</option>
                    <option value="maintenance">صيانة</option>
                    <option value="inactive">غير نشط</option>
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
