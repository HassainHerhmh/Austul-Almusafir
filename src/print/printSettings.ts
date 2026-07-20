/** إعدادات طباعة السندات والكليشة — ألوان ذهبية افتراضية لأسطول المسافر */

export type PrintSettings = {
  /** شعار الطباعة (منفصل عن شعار المنصة) */
  printLogoUrl: string | null
  primaryColor: string
  accentColor: string
  titleBgColor: string
  titleTextColor: string
  frameColor: string
  nameEn: string
  slogan: string
  address: string
  managementPhones: string
  servicePhones: string
  footerNote: string
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  printLogoUrl: null,
  primaryColor: '#1e3a5f',
  accentColor: '#c9a227',
  titleBgColor: '#1d2b44',
  titleTextColor: '#ffffff',
  frameColor: '#1e3a5f',
  nameEn: 'OSTOOL ALMOSAFER',
  slogan: 'الراحة.. وجهتنا',
  address: '',
  managementPhones: '',
  servicePhones: '',
  footerNote: 'هذا السند آلي ولا يحتاج ختم أو توقيع',
}

export function normalizePrintSettings(raw: Partial<PrintSettings> | null | undefined): PrintSettings {
  const d = DEFAULT_PRINT_SETTINGS
  const logo =
    typeof raw?.printLogoUrl === 'string' && raw.printLogoUrl.trim()
      ? raw.printLogoUrl.trim()
      : null
  return {
    printLogoUrl: logo,
    primaryColor: str(raw?.primaryColor, d.primaryColor),
    accentColor: str(raw?.accentColor, d.accentColor),
    titleBgColor: str(raw?.titleBgColor, d.titleBgColor),
    titleTextColor: str(raw?.titleTextColor, d.titleTextColor),
    frameColor: str(raw?.frameColor, d.frameColor),
    nameEn: str(raw?.nameEn, d.nameEn),
    slogan: str(raw?.slogan, d.slogan),
    address: typeof raw?.address === 'string' ? raw.address.trim() : d.address,
    managementPhones:
      typeof raw?.managementPhones === 'string' ? raw.managementPhones.trim() : d.managementPhones,
    servicePhones:
      typeof raw?.servicePhones === 'string' ? raw.servicePhones.trim() : d.servicePhones,
    footerNote: str(raw?.footerNote, d.footerNote),
  }
}

function str(v: unknown, fallback: string) {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}
