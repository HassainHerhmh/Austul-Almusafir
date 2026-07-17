import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import * as IntentLauncher from 'expo-intent-launcher'
import Constants from 'expo-constants'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { Linking, Platform } from 'react-native'
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
      // لا نرمي أبداً من مهمة الخلفية
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

/** يطلب استثناء توفير البطارية حتى لا يقتل النظام التتبع */
export async function requestBatteryUnrestricted() {
  if (Platform.OS !== 'android') return
  const pkg = Constants.expoConfig?.android?.package || 'com.ostool.almosafer.driver'
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      { data: `package:${pkg}` },
    )
  } catch {
    try {
      await Linking.openSettings()
    } catch {
      /* ignore */
    }
  }
}

export async function startTracking(tripId: string): Promise<{ background: boolean }> {
  await stopTrackingLocalOnly()

  const perms = await ensureLocationPermissions()
  if (!perms.background) {
    throw new Error(
      'للتتبع بعد إغلاق الشاشة: اسمح بالموقع «دائماً / أثناء استخدام التطبيق وفي الخلفية»',
    )
  }

  // خدمة أمامية + إشعار مستمر — يستمر بعد مغادرة التطبيق
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
    if (!started) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 12000,
        distanceInterval: 25,
        deferredUpdatesInterval: 12000,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'تتبع الرحلة شغال',
          notificationBody: 'جاري إرسال الموقع للمنصة — يمكنك الإيقاف من الإشعار أو من التطبيق',
          notificationColor: '#0f766e',
        },
      })
    }
  } catch (e) {
    throw new Error(
      e instanceof Error
        ? `تعذر تشغيل التتبع في الخلفية: ${e.message}`
        : 'تعذر تشغيل التتبع في الخلفية',
    )
  }

  // تتبّع إضافي والشاشة مفتوحة
  try {
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
  } catch {
    /* الخلفية كافية */
  }

  try {
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG)
  } catch {
    /* اختياري */
  }

  try {
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })
    await sendPingFromCoords(tripId, current.coords)
  } catch {
    /* تجاهل */
  }

  return { background: true }
}

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
