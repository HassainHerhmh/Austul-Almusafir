import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { getActiveTripId, pingLocation } from './api'

export const LOCATION_TASK = 'austul-bus-tracking'
const KEEP_AWAKE_TAG = 'austul-tracking'

/** يجب استدعاء التعريف مبكراً (من index.ts) قبل أي شاشة */
if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
    try {
      if (error) return
      const tripId = await getActiveTripId()
      if (!tripId) return

      const locations = (data as { locations?: Location.LocationObject[] } | undefined)
        ?.locations
      const loc = locations?.[0]
      if (!loc?.coords) return

      await pingLocation({
        tripId,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        speed: loc.coords.speed,
        heading: loc.coords.heading,
      })
    } catch {
      // لا نرمي أبداً من مهمة الخلفية — يمنع تعطل التطبيق
    }
  })
}

let watchSub: Location.LocationSubscription | null = null
let lastPingAt = 0

async function sendPingFromCoords(
  tripId: string,
  coords: Location.LocationObjectCoords,
) {
  const now = Date.now()
  // حد أدنى 8 ثوانٍ بين الإرسالات لتفادي الضغط على السيرفر والجهاز
  if (now - lastPingAt < 8000) return
  lastPingAt = now
  await pingLocation({
    tripId,
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
    speed: coords.speed,
    heading: coords.heading,
  })
}

export async function ensureLocationPermissions(): Promise<{ background: boolean }> {
  const services = await Location.hasServicesEnabledAsync()
  if (!services) {
    throw new Error('فعّل خدمة الموقع (GPS) من إعدادات الجوال')
  }

  const fg = await Location.requestForegroundPermissionsAsync()
  if (fg.status !== 'granted') {
    throw new Error('يجب السماح بالوصول للموقع')
  }

  let background = false
  try {
    const bg = await Location.requestBackgroundPermissionsAsync()
    background = bg.status === 'granted'
  } catch {
    background = false
  }

  return { background }
}

export async function startTracking(tripId: string): Promise<{ background: boolean }> {
  await stopTrackingLocalOnly()

  const perms = await ensureLocationPermissions()

  // تتبّع أمامي مستقر (أساسي) — يعمل والشاشة مفتوحة
  watchSub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 12000,
      distanceInterval: 25,
      mayShowUserSettingsDialog: true,
    },
    (loc) => {
      void sendPingFromCoords(tripId, loc.coords).catch(() => undefined)
    },
  )

  try {
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG)
  } catch {
    /* اختياري */
  }

  // خلفية اختيارية — إن فشلت لا نوقف التتبع الأمامي
  if (perms.background) {
    try {
      const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
      if (!started) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000,
          distanceInterval: 40,
          deferredUpdatesInterval: 15000,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'تتبع الرحلة نشط',
            notificationBody: 'جاري إرسال موقع الباص — أبقِ التطبيق دون سكون عميق',
            notificationColor: '#0f766e',
          },
        })
      }
    } catch {
      perms.background = false
    }
  }

  // إرسال فوري عند البدء
  try {
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })
    await sendPingFromCoords(tripId, current.coords)
  } catch {
    /* تجاهل */
  }

  return perms
}

/** إيقاف المستمعين محلياً دون استدعاء API */
export async function stopTrackingLocalOnly() {
  try {
    if (watchSub) {
      watchSub.remove()
      watchSub = null
    }
  } catch {
    /* ignore */
  }

  try {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
    if (started) await Location.stopLocationUpdatesAsync(LOCATION_TASK)
  } catch {
    /* ignore */
  }

  try {
    deactivateKeepAwake(KEEP_AWAKE_TAG)
  } catch {
    /* ignore */
  }
}

export async function stopBackgroundTracking() {
  await stopTrackingLocalOnly()
}
