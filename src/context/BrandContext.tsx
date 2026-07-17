import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ApiError } from '../api/client'
import { serverApi } from '../api/serverApi'

const LOCAL_BRAND_KEY = 'austul-brand'
export const DEFAULT_BRAND_NAME = 'أسطول المسافر'

export type BrandSettings = {
  name: string
  logoUrl: string | null
  /** أرقام التواصل لكليشة الطباعة */
  phones: string
}

type BrandContextValue = BrandSettings & {
  brandReady: boolean
  setBrandName: (name: string) => void
  setLogoUrl: (logoUrl: string | null) => void
  saveBrand: (settings: BrandSettings) => Promise<string | null>
  resetBrand: () => Promise<string | null>
}

function normalizeBrand(raw: Partial<BrandSettings> | null | undefined): BrandSettings {
  return {
    name:
      typeof raw?.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : DEFAULT_BRAND_NAME,
    logoUrl: typeof raw?.logoUrl === 'string' && raw.logoUrl ? raw.logoUrl : null,
    phones: typeof raw?.phones === 'string' ? raw.phones : '',
  }
}

/** قراءة قديمة من الجهاز للترحيل لمرة واحدة إن السيرفر فارغ */
function readLocalLegacy(): BrandSettings | null {
  try {
    const raw = localStorage.getItem(LOCAL_BRAND_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BrandSettings>
    const hasCustom =
      (typeof parsed.name === 'string' &&
        parsed.name.trim() &&
        parsed.name.trim() !== DEFAULT_BRAND_NAME) ||
      (typeof parsed.logoUrl === 'string' && !!parsed.logoUrl) ||
      (typeof parsed.phones === 'string' && !!parsed.phones.trim())
    if (!hasCustom) return null
    return normalizeBrand(parsed)
  } catch {
    return null
  }
}

function writeLocalCache(settings: BrandSettings) {
  try {
    localStorage.setItem(LOCAL_BRAND_KEY, JSON.stringify(settings))
  } catch {
    // تجاهل امتلاء التخزين (شعار كبير)
  }
}

const BrandContext = createContext<BrandContextValue | null>(null)

export function BrandProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BrandSettings>(() => ({
    name: DEFAULT_BRAND_NAME,
    logoUrl: null,
    phones: '',
  }))
  const [brandReady, setBrandReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await serverApi.settings.brand.get()
        if (cancelled) return
        const fromServer = normalizeBrand(res.data)
        const serverIsDefault =
          fromServer.name === DEFAULT_BRAND_NAME &&
          !fromServer.logoUrl &&
          !fromServer.phones
        const legacy = serverIsDefault ? readLocalLegacy() : null
        const next = legacy ?? fromServer
        setSettings(next)
        writeLocalCache(next)
      } catch {
        if (cancelled) return
        const legacy = readLocalLegacy()
        if (legacy) setSettings(legacy)
      } finally {
        if (!cancelled) setBrandReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const saveBrand = useCallback(async (next: BrandSettings) => {
    const cleaned = normalizeBrand({
      name: next.name.trim() || DEFAULT_BRAND_NAME,
      logoUrl: next.logoUrl,
      phones: next.phones.trim(),
    })
    try {
      const res = await serverApi.settings.brand.save(cleaned)
      const saved = normalizeBrand(res.data)
      setSettings(saved)
      writeLocalCache(saved)
      return null
    } catch (e) {
      return e instanceof ApiError ? e.message : 'فشل حفظ إعدادات الهوية'
    }
  }, [])

  const setBrandName = useCallback((name: string) => {
    setSettings((prev) => ({ ...prev, name: name.trim() || DEFAULT_BRAND_NAME }))
  }, [])

  const setLogoUrl = useCallback((logoUrl: string | null) => {
    setSettings((prev) => ({ ...prev, logoUrl }))
  }, [])

  const resetBrand = useCallback(async () => {
    return saveBrand({ name: DEFAULT_BRAND_NAME, logoUrl: null, phones: '' })
  }, [saveBrand])

  const value = useMemo(
    () => ({
      ...settings,
      brandReady,
      setBrandName,
      setLogoUrl,
      saveBrand,
      resetBrand,
    }),
    [settings, brandReady, setBrandName, setLogoUrl, saveBrand, resetBrand],
  )

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}

export function useBrand() {
  const ctx = useContext(BrandContext)
  if (!ctx) throw new Error('useBrand must be used within BrandProvider')
  return ctx
}
