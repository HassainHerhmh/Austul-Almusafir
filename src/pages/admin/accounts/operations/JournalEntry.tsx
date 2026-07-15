import React, { useEffect, useMemo, useState } from 'react'
import api from '../../../../api/accountingApi'
import { serverApi } from '../../../../api/serverApi'
import { DEFAULT_BRANCH_NAME } from '../constants'

type Account = {
  id: number
  code?: string
  name_ar: string
}

type Currency = {
  id: number
  name_ar: string
  code: string
}

type Row = {
  id: number
  reference_id: number
  reference_type?: string
  journal_date: string
  amount: number
  currency_name: string
  from_account: string
  to_account: string
  debit_account_id: number
  credit_account_id: number
  notes: string
  user_name: string
  branch_name: string
}

const today = new Date().toLocaleDateString('en-CA')

const JournalEntry: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [rows, setRows] = useState<Row[]>([])

  const [showModal, setShowModal] = useState(false)
  const [selectedRow, setSelectedRow] = useState<Row | null>(null)
  const [editRef, setEditRef] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const [filterDate, setFilterDate] = useState(today)
  const [allDates, setAllDates] = useState(false)

  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [currencyId, setCurrencyId] = useState('')
  const [notes, setNotes] = useState('')

  const [fromAccount, setFromAccount] = useState('')
  const [fromAccountName, setFromAccountName] = useState('')

  const [toAccount, setToAccount] = useState('')
  const [toAccountName, setToAccountName] = useState('')

  const [search, setSearch] = useState('')

  useEffect(() => {
    void fetchAccounts()
    void fetchCurrencies()
    void loadRows()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      const matchDate =
        allDates || (r.journal_date && r.journal_date.slice(0, 10) === filterDate)
      if (!matchDate) return false
      if (!q) return true
      return (
        r.from_account.toLowerCase().includes(q) ||
        r.to_account.toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q) ||
        String(r.reference_id).includes(q)
      )
    })
  }, [rows, search, filterDate, allDates])

  const fetchAccounts = async () => {
    try {
      const res = await serverApi.accounts.sub()
      const seen = new Set<string>()
      setAccounts(
        (res.list ?? [])
          .map((a: any) => ({
            id: a.id,
            code: a.code,
            name_ar: a.name_ar,
          }))
          .filter((a: Account) => {
            const key = a.code || String(a.id)
            if (seen.has(key)) return false
            seen.add(key)
            return true
          }),
      )
    } catch {
      const res = await api.get('/accounts/sub-for-ceiling')
      const data = res.data?.list || res.data || []
      setAccounts(Array.isArray(data) ? data : [])
    }
  }

  const fetchCurrencies = async () => {
    const res = await api.get('/currencies')
    const data =
      res.data?.currencies ||
      res.data?.list ||
      res.data?.data ||
      (Array.isArray(res.data) ? res.data : [])
    setCurrencies(Array.isArray(data) ? data : [])
  }

  const loadRows = async () => {
    try {
      const res = await serverApi.accounts.journalLines({
        types: 'manual_journal',
      })
      const lines = res.list ?? []
      const byRef = new Map<number, typeof lines>()
      lines.forEach((l) => {
        const arr = byRef.get(l.reference_id) || []
        arr.push(l)
        byRef.set(l.reference_id, arr)
      })

      const mapped: Row[] = []
      byRef.forEach((pair, ref) => {
        const debit = pair.find((x) => x.debit > 0)
        const credit = pair.find((x) => x.credit > 0)
        if (!debit && !credit) return
        mapped.push({
          id: debit?.id || credit!.id,
          reference_id: ref,
          reference_type: 'manual_journal',
          journal_date: (debit || credit)!.journal_date,
          amount: debit?.debit || credit?.credit || 0,
          currency_name: '—',
          from_account: debit
            ? `${debit.account_code} — ${debit.account_name}`
            : '—',
          to_account: credit
            ? `${credit.account_code} — ${credit.account_name}`
            : '—',
          debit_account_id: debit?.account_id || 0,
          credit_account_id: credit?.account_id || 0,
          notes: debit?.notes || credit?.notes || '',
          user_name: 'مدير النظام',
          branch_name: DEFAULT_BRANCH_NAME,
        })
      })
      mapped.sort((a, b) => b.journal_date.localeCompare(a.journal_date) || b.id - a.id)
      setRows(mapped)
    } catch {
      const res = await api.get('/journal-entries')
      if (res.data?.success) {
        setRows(
          (res.data.list || []).map((r: any) => ({
            ...r,
            debit_account_id: r.debit_account_id || 0,
            credit_account_id: r.credit_account_id || 0,
          })),
        )
      }
    }
  }

  const resetForm = () => {
    setDate(today)
    setAmount('')
    setCurrencyId(currencies[0] ? String(currencies[0].id) : '')
    setFromAccount('')
    setFromAccountName('')
    setToAccount('')
    setToAccountName('')
    setNotes('')
    setEditRef(null)
  }

  const openAdd = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (row?: Row | null) => {
    const target = row ?? selectedRow
    if (!target) {
      alert('حدد قيدًا أولاً')
      return
    }
    const debitAcc = accounts.find((a) => a.id === target.debit_account_id)
    const creditAcc = accounts.find((a) => a.id === target.credit_account_id)
    setSelectedRow(target)
    setEditRef(target.reference_id)
    setDate(target.journal_date.slice(0, 10))
    setAmount(String(target.amount))
    setFromAccount(String(target.debit_account_id || ''))
    setFromAccountName(debitAcc?.name_ar || target.from_account)
    setToAccount(String(target.credit_account_id || ''))
    setToAccountName(creditAcc?.name_ar || target.to_account)
    setNotes(target.notes || '')
    setShowModal(true)
  }

  const remove = async () => {
    if (!selectedRow) {
      alert('حدد قيدًا أولاً')
      return
    }
    if (!selectedRow.reference_id) {
      alert('هذا السطر لا يملك رقم سند صالح')
      return
    }
    if (!window.confirm('هل أنت متأكد من حذف القيد بالكامل؟')) return

    try {
      await serverApi.accounts.deleteManualJournal(selectedRow.reference_id)
      await loadRows()
      setSelectedRow(null)
      alert('تم حذف القيد')
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'حدث خطأ أثناء حذف القيد')
    }
  }

  const saveEntry = async () => {
    if (!fromAccount || !toAccount || !amount) {
      alert('يرجى إدخال الحسابات والمبلغ')
      return
    }
    if (fromAccount === toAccount) {
      alert('الحساب المدين والدائن يجب أن يختلفا')
      return
    }

    const payload = {
      journal_date: date,
      amount: Number(amount),
      debit_account_id: Number(fromAccount),
      credit_account_id: Number(toAccount),
      notes: notes || 'قيد يومي',
    }

    setBusy(true)
    try {
      if (editRef) {
        await serverApi.accounts.updateManualJournal(editRef, payload)
      } else {
        await serverApi.accounts.createManualJournal(payload)
      }
      await loadRows()
      setShowModal(false)
      resetForm()
      setSelectedRow(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل حفظ القيد')
    } finally {
      setBusy(false)
    }
  }

  const AccountInput = ({
    value,
    setValue,
    setId,
    placeholder,
  }: {
    value: string
    setValue: (v: string) => void
    setId: (v: string) => void
    placeholder: string
  }) => {
    const [open, setOpen] = useState(false)

    const list =
      value.trim() === ''
        ? accounts
        : accounts.filter(
            (a) =>
              a.name_ar.toLowerCase().includes(value.toLowerCase()) ||
              (a.code || '').includes(value),
          )

    return (
      <div className="relative w-full">
        <input
          className="acc-input w-full"
          placeholder={placeholder}
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setValue(e.target.value)
            setOpen(true)
          }}
        />

        {open && (
          <div className="acc-dropdown absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg">
            {list.map((a) => (
              <div
                key={a.id}
                className="acc-dropdown-item cursor-pointer px-3 py-2"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setValue(a.name_ar)
                  setId(String(a.id))
                  setOpen(false)
                }}
              >
                {a.code ? `${a.code} — ` : ''}
                {a.name_ar}
              </div>
            ))}

            {list.length === 0 && (
              <div className="acc-muted px-3 py-2">لا توجد نتائج</div>
            )}
          </div>
        )}
      </div>
    )
  }

  const getCode = (id: string) => accounts.find((a) => a.id === Number(id))?.code || ''

  return (
    <div className="space-y-4">
      <div className="acc-toolbar">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openAdd} className="acc-btn acc-btn-primary px-4 py-2 rounded-lg">
            إضافة
          </button>
          <button
            type="button"
            onClick={() => openEdit()}
            disabled={!selectedRow}
            className={`acc-btn acc-btn-outline px-4 py-2 rounded-lg ${
              !selectedRow ? 'cursor-not-allowed opacity-50' : ''
            }`}
          >
            تعديل
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={!selectedRow}
            className={`acc-btn acc-btn-danger px-4 py-2 rounded-lg ${
              !selectedRow ? 'cursor-not-allowed opacity-50' : ''
            }`}
          >
            حذف
          </button>
          <button
            type="button"
            onClick={() => void loadRows()}
            className="acc-btn acc-btn-outline px-4 py-2 rounded-lg"
          >
            تحديث
          </button>
        </div>

        <input
          placeholder="بحث..."
          className="acc-input w-56"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex justify-between items-center px-1">
        <div className="acc-muted text-sm">
          {allDates ? 'عرض كل التواريخ' : `عرض يوم ${filterDate}`}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            className="acc-input w-40"
            disabled={allDates}
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allDates}
              onChange={(e) => setAllDates(e.target.checked)}
            />
            كل التواريخ
          </label>
        </div>
      </div>

      <div className="acc-table-wrap">
        <table className="acc-table text-center">
          <thead>
            <tr>
              <th>رقم السند</th>
              <th>التاريخ</th>
              <th>المبلغ</th>
              <th>من حساب</th>
              <th>إلى حساب</th>
              <th>ملاحظات</th>
              <th>المستخدم</th>
              <th>الفرع</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((r) => (
                <tr
                  key={r.reference_id}
                  onClick={() => setSelectedRow(r)}
                  onDoubleClick={() => openEdit(r)}
                  className={`cursor-pointer ${
                    selectedRow?.reference_id === r.reference_id ? 'acc-row-selected' : ''
                  }`}
                >
                  <td>{r.reference_id}</td>
                  <td>{r.journal_date}</td>
                  <td>{r.amount.toLocaleString('ar-YE')}</td>
                  <td>{r.from_account}</td>
                  <td>{r.to_account}</td>
                  <td>{r.notes}</td>
                  <td>{r.user_name}</td>
                  <td>{r.branch_name || DEFAULT_BRANCH_NAME}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="acc-muted py-6">
                  لا توجد بيانات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="acc-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="acc-modal-panel w-full max-w-[720px] space-y-4 rounded-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="acc-heading text-center text-lg">
              {editRef ? 'تعديل قيد يومي' : 'إضافة قيد يومي'}
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="acc-muted mb-1 block text-sm">التاريخ</label>
                <input
                  type="date"
                  className="acc-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="acc-muted mb-1 block text-sm">العملة</label>
                <select
                  className="acc-select"
                  value={currencyId}
                  onChange={(e) => setCurrencyId(e.target.value)}
                >
                  <option value="">— اختياري —</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name_ar} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="acc-muted mb-1 block text-sm">المبلغ</label>
                <input
                  className="acc-input"
                  type="number"
                  min={1}
                  placeholder="المبلغ"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="acc-muted mb-1 block text-sm">الحساب المدين</label>
                <AccountInput
                  value={fromAccountName}
                  setValue={setFromAccountName}
                  setId={setFromAccount}
                  placeholder="ابحث عن الحساب المدين"
                />
                <input
                  disabled
                  className="acc-input mt-1"
                  placeholder="كود الحساب"
                  value={getCode(fromAccount)}
                />
              </div>
              <div>
                <label className="acc-muted mb-1 block text-sm">الحساب الدائن</label>
                <AccountInput
                  value={toAccountName}
                  setValue={setToAccountName}
                  setId={setToAccount}
                  placeholder="ابحث عن الحساب الدائن"
                />
                <input
                  disabled
                  className="acc-input mt-1"
                  placeholder="كود الحساب"
                  value={getCode(toAccount)}
                />
              </div>
            </div>

            <div>
              <label className="acc-muted mb-1 block text-sm">ملاحظات</label>
              <textarea
                className="acc-textarea"
                rows={3}
                placeholder="ملاحظات"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
                className="acc-btn acc-btn-outline rounded-lg px-5 py-2"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void saveEntry()}
                disabled={busy}
                className="acc-btn acc-btn-primary rounded-lg px-5 py-2"
              >
                {busy ? 'جاري الحفظ…' : editRef ? 'حفظ التعديل' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default JournalEntry
