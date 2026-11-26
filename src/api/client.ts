const TOKEN_KEY = 'austul-auth-token'

export const API_BASE = (
  import.meta.env.VITE_API_URL ||
    'https://mediumvioletred-dugong-691934.hostingersite.com'
).replace(/\/$/, '')

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

type ApiOk<T> = { success: true } & T
type ApiFail = {
  success: false
  message?: string
  diagnostics?: TlbApiDiagnostics
  responseBody?: string
  statusCode?: number | null
}

export type TlbApiDiagnostics = {
  requestUrl: string
  authMode: 'hmac' | 'api_key_header'
  companyId: string
  apiKeySuffix: string
  httpStatus: number | null
  reachedAuthority: boolean
  rawResponseBody: string
  hintAr: string
  tlbApiKeyId?: number
}

export class ApiError extends Error {
  status: number
  tlb?: {
    diagnostics?: TlbApiDiagnostics
    responseBody?: string
    statusCode?: number | null
  }
  constructor(message: string, status = 400, tlb?: ApiError['tlb']) {
    super(message)
    this.status = status
    this.tlb = tlb
  }
}

export const ACCOUNT_SUSPENDED_EVENT = 'austul:account-suspended'

export async function apiRequest<T extends Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
): Promise<ApiOk<T>> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('Cache-Control', 'no-cache')
  headers.set('Pragma', 'no-cache')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  })
  let data: ApiOk<T> | ApiFail
  try {
    data = (await res.json()) as ApiOk<T> | ApiFail
  } catch {
    const fallback =
      res.status === 404
        ? 'السيرفر لا يدعم هذا الطلب بعد — حدّث وشغّل API (npm run setup:hostinger)'
        : res.status >= 502
          ? 'السيرفر غير متاح مؤقتاً'
          : 'تعذر الاتصال بالسيرفر — تحقق من عنوان API والسيرفر'
    throw new ApiError(fallback, res.status)
  }

  if (!res.ok || !data.success) {
    const fail = data as ApiFail
    const msg = typeof fail.message === 'string' && fail.message ? fail.message : 'حدث خطأ'
    if (res.status === 401) setToken(null)
    if (res.status === 403 && /إيقاف|موقوف/.test(msg)) {
      setToken(null)
      window.dispatchEvent(new CustomEvent(ACCOUNT_SUSPENDED_EVENT, { detail: msg }))
    }
    throw new ApiError(msg, res.status, {
      diagnostics: fail.diagnostics,
      responseBody: fail.responseBody,
      statusCode: fail.statusCode,
    })
  }
  return data
}
