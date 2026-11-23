/** مسار البوابة الحالية: إدارة الوكالة أو مدير فرع */
export type PortalBase = '/admin' | '/branch'

export function getPortalBaseFromPath(pathname: string): PortalBase {
  return pathname.startsWith('/branch') ? '/branch' : '/admin'
}

/** يحوّل مساراً يبدأ بـ /admin إلى البوابة الحالية (/branch عند مدير الفرع) */
export function portalPathFrom(pathname: string, adminAbsolutePath: string): string {
  if (!adminAbsolutePath.startsWith('/admin')) return adminAbsolutePath
  return adminAbsolutePath.replace(/^\/admin/, getPortalBaseFromPath(pathname))
}

export function accountsBaseFromPath(pathname: string): string {
  return `${getPortalBaseFromPath(pathname)}/accounts`
}