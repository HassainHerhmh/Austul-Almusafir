import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const BRAND_KEY = 'austul-brand'
export const DEFAULT_BRAND_NAME = 'أسطول المسافر'

export type BrandSettings = {
  name: string
  logoUrl: string | null
  /** أرقام التواصل لكليشة الطباعة (سطر لكل رقم أو مفصولة بفاصلة) */
  phones: string
}

type BrandContextValue = BrandSettings & {
  setBrandName: (name: string) => void
  setLogoUrl: (logoUrl: string | null) => void
  saveBrand: (settings: BrandSettings) => void
  resetBrand: () => void
}

function loadBrand(): BrandSettings {
  try {
    const raw = localStorage.getItem(BRAND_KEY)
    if (!raw) return { name: DEFAULT_BRAND_NAME, logoUrl: null, phones: '' }
    const parsed = JSON.parse(raw) as Partial<BrandSettings>
    return {
      name:
        typeof parsed.name === 'string' && parsed.name.trim()
          ? parsed.name.trim()
          : DEFAULT_BRAND_NAME,
      logoUrl: typeof parsed.logoUrl === 'string' && parsed.logoUrl ? parsed.logoUrl : null,
      phones: typeof parsed.phones === 'string' ? parsed.phones : '',
    }
  } catch {
    return { name: DEFAULT_BRAND_NAME, logoUrl: null, phones: '' }
  }
}

function persist(settings: BrandSettings) {
  localStorage.setItem(BRAND_KEY, JSON.stringify(settings))
}

const BrandContext = createContext<BrandContextValue | null>(null)

export function BrandProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BrandSettings>(() => loadBrand())

  const saveBrand = useCallback((next: BrandSettings) => {
    const cleaned: BrandSettings = {
      name: next.name.trim() || DEFAULT_BRAND_NAME,
      logoUrl: next.logoUrl,
      phones: next.phones.trim(),
    }
    persist(cleaned)
    setSettings(cleaned)
  }, [])

  const setBrandName = useCallback((name: string) => {
    setSettings((prev) => {
      const next = { ...prev, name: name.trim() || DEFAULT_BRAND_NAME }
      persist(next)
      return next
    })
  }, [])

  const setLogoUrl = useCallback((logoUrl: string | null) => {
    setSettings((prev) => {
      const next = { ...prev, logoUrl }
      persist(next)
      return next
    })
  }, [])

  const resetBrand = useCallback(() => {
    const next = { name: DEFAULT_BRAND_NAME, logoUrl: null, phones: '' }
    persist(next)
    setSettings(next)
  }, [])

  const value = useMemo(
    () => ({
      ...settings,
      setBrandName,
      setLogoUrl,
      saveBrand,
      resetBrand,
    }),
    [settings, setBrandName, setLogoUrl, saveBrand, resetBrand],
  )

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}

export function useBrand() {
  const ctx = useContext(BrandContext)
  if (!ctx) throw new Error('useBrand must be used within BrandProvider')
  return ctx
}
