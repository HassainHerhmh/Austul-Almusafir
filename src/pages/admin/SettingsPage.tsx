import { useEffect, useRef, useState } from 'react'
import { serverApi } from '../../api/serverApi'
import { DEFAULT_BRAND_NAME, useBrand } from '../../context/BrandContext'
import type { PricingMode } from '../../types'

const MAX_BYTES = 900_000

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'))
    reader.readAsDataURL(file)
  })
}

export function SettingsPage() {
  const { name, logoUrl, saveBrand, resetBrand } = useBrand()
  const [draftName, setDraftName] = useState(name)
  const [draftLogo, setDraftLogo] = useState<string | null>(logoUrl)
  const [pricingMode, setPricingMode] = useState<PricingMode>('trip')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void serverApi.settings.pricing
      .get()
      .then((res) => {
        setPricingMode(res.data?.mode === 'boarding' ? 'boarding' : 'trip')
      })
      .catch(() => {
        setPricingMode('trip')
      })
  }, [])

  const onPickLogo = async (file: File | null) => {
    setError(null)
    setMessage(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('الرجاء اختيار ملف صورة')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('حجم الشعار كبير جداً — اختر صورة أصغر من 900 كيلوبايت')
      return
    }
    try {
      const dataUrl = await readAsDataUrl(file)
      setDraftLogo(dataUrl)
    } catch {
      setError('تعذر تحميل الشعار')
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      saveBrand({ name: draftName, logoUrl: draftLogo })
      await serverApi.settings.pricing.save({ mode: pricingMode })
      setMessage('تم حفظ إعدادات المنصة وتسعيرة الرحلة')
    } catch {
      setError('تعذر حفظ إعدادات التسعير')
    }
  }

  const restore = () => {
    resetBrand()
    setDraftName(DEFAULT_BRAND_NAME)
    setDraftLogo(null)
    setPricingMode('trip')
    void serverApi.settings.pricing.save({ mode: 'trip' }).catch(() => {})
    setMessage('تمت استعادة الاسم والشعار والتسعير الافتراضي')
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>إعدادات المنصة</h1>
          <p>الشعار واسم المنصة وتسعيرة الرحلة</p>
        </div>
      </header>

      <div className="panel settings-panel">
        <form onSubmit={(e) => void save(e)} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="field">
            <label htmlFor="platform-name">اسم المنصة</label>
            <input
              id="platform-name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={DEFAULT_BRAND_NAME}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="platform-logo">شعار المنصة</label>
            <input
              id="platform-logo"
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => void onPickLogo(e.target.files?.[0] ?? null)}
            />
            <p className="field-hint">يستبدل أيقونة الباص في الشريط الجانبي وصفحة الدخول</p>
          </div>

          <div className="field">
            <label htmlFor="pricing-mode">تسعيرة الرحلة</label>
            <select
              id="pricing-mode"
              value={pricingMode}
              onChange={(e) => setPricingMode(e.target.value as PricingMode)}
            >
              <option value="trip">حسب الرحلة — يعتمد سعر التذكرة المحدد في الرحلة</option>
              <option value="boarding">
                حسب منطقة الصعود — يعتمد سعر المنطقة من إدارة الوجهات
              </option>
            </select>
            <p className="field-hint">
              {pricingMode === 'trip'
                ? 'سعر الحجز = السعر المعرّف عند إنشاء الرحلة'
                : 'سعر الحجز = سعر الوجهة المختارة كمنطقة صعود'}
            </p>
          </div>

          <div className="settings-preview">
            <span className="settings-preview-label">معاينة</span>
            <div className="brand-mark settings-preview-brand">
              <div className={`brand-icon${draftLogo ? ' has-logo' : ''}`}>
                {draftLogo ? <img src={draftLogo} alt="" /> : <span aria-hidden>🚌</span>}
              </div>
              <div>
                <div className="brand-name">{draftName.trim() || DEFAULT_BRAND_NAME}</div>
                <div className="brand-sub">لوحة مدير النظام</div>
              </div>
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}
          {message && <p className="success-msg">{message}</p>}

          <div className="actions">
            <button type="submit" className="btn btn-primary">
              حفظ
            </button>
            {draftLogo && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setDraftLogo(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
              >
                إزالة الشعار
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={restore}>
              استعادة الافتراضي
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
