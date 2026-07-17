import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

const TOKEN_KEY = 'austul-driver-token'
const TRIP_KEY = 'austul-tracking-trip'
const API_KEY = 'austul-api-url'

export function getDefaultApiUrl() {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined
  return (extra?.apiUrl || 'https://api.ostool-almosafer.com').replace(/\/$/, '')
}

export async function getApiUrl() {
  const saved = await AsyncStorage.getItem(API_KEY)
  return (saved || getDefaultApiUrl()).replace(/\/$/, '')
}

export async function setApiUrl(url: string) {
  await AsyncStorage.setItem(API_KEY, url.replace(/\/$/, ''))
}

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY)
}

export async function setToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token)
  else await AsyncStorage.removeItem(TOKEN_KEY)
}

export async function getActiveTripId() {
  return AsyncStorage.getItem(TRIP_KEY)
}

export async function setActiveTripId(tripId: string | null) {
  if (tripId) await AsyncStorage.setItem(TRIP_KEY, tripId)
  else await AsyncStorage.removeItem(TRIP_KEY)
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
  const base = await getApiUrl()
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  const token = await getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${base}${path}`, { ...options, headers })
  let data: ApiOk<T> | ApiFail
  try {
    data = (await res.json()) as ApiOk<T> | ApiFail
  } catch {
    throw new ApiError('تعذر الاتصال بالسيرفر', res.status)
  }
  if (!res.ok || !data.success) {
    const msg =
      typeof (data as ApiFail).message === 'string' && (data as ApiFail).message
        ? (data as ApiFail).message!
        : 'حدث خطأ'
    if (res.status === 401) await setToken(null)
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
  return res.user
}

export async function fetchMyTrips() {
  const res = await apiRequest<{ list: DriverTrip[] }>('/api/tracking/my-trips')
  return res.list
}

export async function pingLocation(payload: {
  tripId: string
  lat: number
  lng: number
  accuracy?: number | null
  speed?: number | null
  heading?: number | null
}) {
  return apiRequest('/api/tracking/ping', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function stopTracking(tripId: string) {
  return apiRequest('/api/tracking/stop', {
    method: 'POST',
    body: JSON.stringify({ tripId }),
  })
}
