import { useState } from 'react'
import { formatMoney, todayStr } from '../../components/utils'
import { useApp } from '../../context/AppContext'
import type { VoucherType } from '../../types'

export function OfficeAccountingPage() {
  const { state, currentOffice, can, addVoucher, getOfficeAgencyBalance } = useApp()
  const officeId = currentOffice!.id

  const vouchers = state.vouchers
    .filter((v) => v.officeId === officeId)
    .sort((a, b) => b.date.localeCompare(a.date))

  const receipts = vouchers.filter((v) => v.type === 'receipt').reduce((s, v) => s + v.amount, 0)
  const payments = vouchers.filter((v) => v.type === 'payment').reduce((s, v) => s + v.amount, 0)
  const cash = receipts - payments
  const agencyBalance = getOfficeAgencyBalance(officeId)

  const [open, setOpen] = useState(false)
  const [type, setType] = useState<VoucherType>('receipt')
  const [amount, setAmount] = useState(0)
  const [description, setDescription] = useState('')

  if (!can('view_accounts')) {
    return (
      <div className="panel">
        <div className="empty">ليس لديك صلاحية عرض الحسابات</div>
      </div>
    )
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    addVoucher({
      officeId,
      type,
      amount,
      description,
      date: todayStr(),
    })
    setOpen(false)
    setAmount(0)
    setDescription('')
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>المحاسبة</h1>
          <p>صندوق · سندات قبض وصرف · كشف حساب {currentOffice?.name}</p>
        </div>
        <button type="button" className="btn btn-amber" onClick={() => setOpen(true)}>
          سند جديد
        </button>
      </header>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">الرصيد عليكم لدى الوكالة</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(agencyBalance)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">سندات القبض (إيرادات)</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(receipts)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">سندات الصرف (مصروفات)</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(payments)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">رصيد الصندوق</div>
          <div className="stat-value" style={{ fontSize: '1.15rem' }}>
            {formatMoney(cash)}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>كشف الحساب</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>الوصف</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.id}>
                  <td>{v.date}</td>
                  <td>
                    <span className={`badge ${v.type === 'receipt' ? 'badge-ok' : 'badge-warn'}`}>
                      {v.type === 'receipt' ? 'قبض' : 'صرف'}
                    </span>
                  </td>
                  <td>{v.description}</td>
                  <td>{formatMoney(v.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>سند جديد</h2>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="field">
                  <label>النوع</label>
                  <select value={type} onChange={(e) => setType(e.target.value as VoucherType)}>
                    <option value="receipt">سند قبض</option>
                    <option value="payment">سند صرف</option>
                  </select>
                </div>
                <div className="field">
                  <label>المبلغ</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                </div>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>الوصف</label>
                  <input
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
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
