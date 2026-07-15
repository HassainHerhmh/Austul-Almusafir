import { useEffect, useState } from 'react'
import { serverApi } from '../../../../api/serverApi'
import api from '../../../../api/accountingApi'

type Account = {
  id: number
  code: string
  name_ar: string
}

const TransitAccountsSettings = () => {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [officeCommissions, setOfficeCommissions] = useState<number | ''>('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await serverApi.accounts.sub()
        const rows = (res.list ?? []).map((a: any) => ({
          id: a.id,
          code: a.code,
          name_ar: a.name_ar,
        }))
        setAccounts(rows.sort((a, b) => a.code.localeCompare(b.code, 'ar')))
      } catch {
        try {
          const res = await (api as any).accounts.getAccounts()
          const subs = (res.list || [])
            .filter((a: any) => a.parent_id !== null)
            .map((a: any) => ({ id: a.id, code: a.code ?? '', name_ar: a.name_ar }))
          setAccounts(subs)
        } catch {
          setAccounts([])
        }
      }

      try {
        const res = await serverApi.settings.transitAccounts.get()
        const id = res.data?.office_commissions_account
        setOfficeCommissions(id || '')
      } catch {
        try {
          const res = await api.get('/settings/transit-accounts')
          const d = res.data?.data || {}
          setOfficeCommissions(d.office_commissions_account || '')
        } catch {
          setOfficeCommissions('')
        }
      }
    })()
  }, [])

  const save = async () => {
    setBusy(true)
    setMessage(null)
    const payload = {
      office_commissions_account: officeCommissions === '' ? null : Number(officeCommissions),
    }
    try {
      await serverApi.settings.transitAccounts.save(payload)
      try {
        await api.post('/settings/transit-accounts', payload)
      } catch {
        /* وحدة المحاسبة المحلية اختيارية */
      }
      setMessage('تم حفظ حساب وسيط عمولات المكاتب')
    } catch {
      try {
        await api.post('/settings/transit-accounts', payload)
        setMessage('تم الحفظ محلياً')
      } catch {
        setMessage('فشل حفظ الإعدادات')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <h2 className="text-lg font-bold acc-link">الحسابات الوسيطة (Transit)</h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
        يُستخدم قيد عمولة كل حجز: من هذا الحساب إلى الحساب المحاسبي للمكتب.
      </p>

      <div className="acc-card border rounded-xl p-4 space-y-2 shadow-sm" style={{ maxWidth: 480 }}>
        <div className="text-sm font-semibold text-gray-700">حساب وسيط عمولات المكاتب</div>
        <select
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          value={officeCommissions}
          onChange={(e) =>
            setOfficeCommissions(e.target.value ? Number(e.target.value) : '')
          }
        >
          <option value="">اختر حساب</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code ? `${a.code} — ` : ''}
              {a.name_ar}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 justify-end">
        {message && <span className="perm-save-notice">{message}</span>}
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="acc-btn acc-btn-primary px-6 py-2 rounded-lg"
        >
          {busy ? 'جاري الحفظ…' : 'حفظ الإعدادات'}
        </button>
      </div>
    </div>
  )
}

export default TransitAccountsSettings
