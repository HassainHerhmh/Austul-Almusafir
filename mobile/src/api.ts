import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

const TOKEN_KEY = 'austul-driver-token'
const TRIP_KEY = 'austul-tracking-trip'
const API_KEY = 'austul-api-url'
const USER_NAME_KEY = 'austul-driver-name'

export function getDefaultApiUrl() {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined
  return (extra?.apiUrl || 'https://api.ostool-almosafer.com').replace(/\/$/, '')
}

export async function getApiUrl() {
  try {
    const saved = await AsyncStorage.getItem(API_KEY)
    return (saved || getDefaultApiUrl()).replace(/\/$/, '')
  } catch {
    return getDefaultApiUrl()
  }
}

export async function setApiUrl(url: string) {
  await AsyncStorage.setItem(API_KEY, url.replace(/\/$/, ''))
}

export async function getToken() {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export async function setToken(token: string | null) {
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token)
    else await AsyncStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore storage errors */
  }
}

export async function getSavedUserName() {
  try {
    return (await AsyncStorage.getItem(USER_NAME_KEY)) || 'سائق'
  } catch {
    return 'سائق'
  }
}

export async function setSavedUserName(name: string | null) {
  try {
    if (name) await AsyncStorage.setItem(USER_NAME_KEY, name)
    else await AsyncStorage.removeItem(USER_NAME_KEY)
  } catch {
    /* ignore */
  }
}

export async function getActiveTripId() {
  try {
    return await AsyncStorage.getItem(TRIP_KEY)
  } catch {
    return null
  }
}

export async function setActiveTripId(tripId: string | null) {
  try {
    if (tripId) await AsyncStorage.setItem(TRIP_KEY, tripId)
    else await AsyncStorage.removeItem(TRIP_KEY)
  } catch {
    /* ignore */
  }
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
  options: RequestInit & { clearOn401?: boolean; timeoutMs?: number } = {},
): Promise<ApiOk<T>> {
  const { clearOn401 = true, timeoutMs = 20000, ...fetchOptions } = options
  const base = await getApiUrl()
  const headers = new Headers(fetchOptions.headers)
  if (!headers.has('Content-Type') && fetchOptions.body) {
    headers.set('Content-Type', 'application/json')
  }
  const token = await getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(`${base}${path}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ApiError('انتهت مهلة الاتصال بالسيرفر', 408)
    }
    throw new ApiError('تعذر الاتصال بالسيرفر', 0)
  } finally {
    clearTimeout(timer)
  }

  let data: ApiOk<T> | ApiFail
  try {
    data = (await res.json()) as ApiOk<T> | ApiFail
  } catch {
    throw new ApiError('استجابة غير صالحة من السيرفر', res.status)
  }

  if (!res.ok || !data.success) {
    const msg =
      typeof (data as ApiFail).message === 'string' && (data as ApiFail).message
        ? (data as ApiFail).message!
        : 'حدث خطأ'
    if (res.status === 401 && clearOn401) await setToken(null)
    throw new ApiError(msg, res.status)
  }
  return data
}

export type DriverTrip = {
  id: string
  date: string
  departureTime: string
  status: string
  busNumber: string
  plateNumber: string
  label: string
  trackingActive: boolean
  lastUpdatedAt: string | null
}

export async function login(username: string, password: string) {
  const res = await apiRequest<{ token: string; user: { role: string; name: string } }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    },
  )
  if (res.user.role !== 'driver') {
    throw new ApiError('هذا الحساب ليس حساب سائق تتبع')
  }
  await setToken(res.token)
  await setSavedUserName(res.user.name)
  return res.user
}

export async function fetchMyTrips() {
  const res = await apiRequest<{ list: DriverTrip[] }>('/api/tracking/my-trips')
  return res.list ?? []
}

export async function pingLocation(payload: {
  tripId: string
  lat: number
  lng: number
  accuracy?: number | null
  speed?: number | null
  heading?: number | null
}) {
  if (
    !Number.isFinite(payload.lat) ||
    !Number.isFinite(payload.lng) ||
    Math.abs(payload.lat) > 90 ||
    Math.abs(payload.lng) > 180
  ) {
    return null
  }
  return apiRequest(
    '/api/tracking/ping',
    {
      method: 'POST',
      body: JSON.stringify({
        tripId: payload.tripId,
        lat: payload.lat,
        lng: payload.lng,
        accuracy: payload.accuracy ?? null,
        speed:
          payload.speed != null && Number.isFinite(payload.speed) ? payload.speed : null,
        heading:
          payload.heading != null && Number.isFinite(payload.heading)
            ? payload.heading
            : null,
      }),
      clearOn401: false,
      timeoutMs: 15000,
    },
  )
}

export async function stopTracking(tripId: string) {
  return apiRequest('/api/tracking/stop', {
    method: 'POST',
    body: JSON.stringify({ tripId }),
    clearOn401: false,
    timeoutMs: 10000,
  })
}
