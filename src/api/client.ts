const TOKEN_KEY = 'austul-auth-token'

export const API_BASE = (
  import.meta.env.VITE_API_URL || 'https://api.ostool-almosafer.com'
).replace(/\/$/, '')

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

type ApiOk<T> = { success: true } & T
type ApiFail = { success: false; message?: string }

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export async function apiRequest<T extends Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
): Promise<ApiOk<T>> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  let data: ApiOk<T> | ApiFail
  try {
    data = (await res.json()) as ApiOk<T> | ApiFail
  } catch {
    throw new ApiError('تعذر الاتصال بالسيرفر', res.status)
  }

  if (!res.ok || !data.success) {
    const fail = data as ApiFail
    const msg = typeof fail.message === 'string' && fail.message ? fail.message : 'حدث خطأ'
    if (res.status === 401) setToken(null)
    throw new ApiError(msg, res.status)
  }
  return data
}
