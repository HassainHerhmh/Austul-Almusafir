import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import * as IntentLauncher from 'expo-intent-launcher'
import Constants from 'expo-constants'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { Linking, Platform } from 'react-native'
import { getActiveTripId, pingLocation } from './api'

export const LOCATION_TASK = 'austul-bus-tracking'
const KEEP_AWAKE_TAG = 'austul-tracking'
/** نبضة إرسال للمنصة حتى لو الباص متوقف (بدون حركة GPS) */
const HEARTBEAT_MS = 25000
const MIN_PING_GAP_MS = 5000

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

      await sendPingFromCoords(tripId, loc.coords, true)
    } catch {
      // لا نرمي أبداً من مهمة الخلفية
    }
  })
}

let watchSub: Location.LocationSubscription | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let lastPingAt = 0
let lastCoords: Location.LocationObjectCoords | null = null
let heartbeatTripId: string | null = null

async function sendPingFromCoords(
  tripId: string,
  coords: Location.LocationObjectCoords,
  force = false,
) {
  const now = Date.now()
  if (!force && now - lastPingAt < MIN_PING_GAP_MS) return
  lastPingAt = now
  lastCoords = coords
  await pingLocation({
    tripId,
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
    speed: coords.speed,
    heading: coords.heading,
  })
}

/** يقرأ موقعاً جديداً أو يعيد آخر إحداثيات معروفة ويرسلها للسيرفر */
export async function heartbeatPing(tripId?: string | null) {
  const id = tripId || heartbeatTripId || (await getActiveTripId())
  if (!id) return false

  try {
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: false,
    })
    await sendPingFromCoords(id, current.coords, true)
    return true
  } catch {
    if (lastCoords) {
      try {
        await sendPingFromCoords(id, lastCoords, true)
        return true
      } catch {
        return false
      }
    }
    return false
  }
}

function startHeartbeat(tripId: string) {
  heartbeatTripId = tripId
  stopHeartbeat(false)
  void heartbeatPing(tripId)
  heartbeatTimer = setInterval(() => {
    void heartbeatPing(heartbeatTripId)
  }, HEARTBEAT_MS)
}

function stopHeartbeat(clearTrip = true) {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  if (clearTrip) heartbeatTripId = null
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

async function startBackgroundLocationTask() {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
  if (started) {
    // أعد التشغيل بإعدادات أحدث إن كانت الخدمة قديمة بدون نبضات زمنية
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK)
    } catch {
      /* continue */
    }
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    // Android: تحديثات زمنية حتى مع توقف الحركة (distanceInterval: 0)
    timeInterval: 15000,
    distanceInterval: 0,
    deferredUpdatesInterval: 0,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'تتبع الرحلة شغال',
      notificationBody:
        'جاري إرسال الموقع للمنصة — للإيقاف استخدم زر «إيقاف التتبع» أو من داخل التطبيق',
      notificationColor: '#0f766e',
      killServiceOnDestroy: false,
    },
  })
}

export async function isBackgroundTrackingRunning() {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
  } catch {
    return false
  }
}

/** يعيد تشغيل خدمة التتبع إن توقفت بينما الرحلة ما زالت نشطة */
export async function ensureTrackingRunning(tripId: string) {
  const perms = await ensureLocationPermissions()
  if (!perms.background) {
    throw new Error('صلاحية الموقع في الخلفية غير ممنوحة')
  }
  await startBackgroundLocationTask()
  startHeartbeat(tripId)

  if (!watchSub) {
    try {
      watchSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000,
          distanceInterval: 0,
          mayShowUserSettingsDialog: false,
        },
        (loc) => {
          void sendPingFromCoords(tripId, loc.coords).catch(() => undefined)
        },
      )
    } catch {
      /* الخلفية + النبضة كافيان */
    }
  }

  try {
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG)
  } catch {
    /* اختياري */
  }

  await heartbeatPing(tripId)
}

export async function startTracking(tripId: string): Promise<{ background: boolean }> {
  await stopTrackingLocalOnly()

  const perms = await ensureLocationPermissions()
  if (!perms.background) {
    throw new Error(
      'للتتبع بعد إغلاق الشاشة: اسمح بالموقع «دائماً / أثناء استخدام التطبيق وفي الخلفية»',
    )
  }

  try {
    await startBackgroundLocationTask()
  } catch (e) {
    throw new Error(
      e instanceof Error
        ? `تعذر تشغيل التتبع في الخلفية: ${e.message}`
        : 'تعذر تشغيل التتبع في الخلفية',
    )
  }

  startHeartbeat(tripId)

  try {
    watchSub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15000,
        distanceInterval: 0,
        mayShowUserSettingsDialog: true,
      },
      (loc) => {
        void sendPingFromCoords(tripId, loc.coords).catch(() => undefined)
      },
    )
  } catch {
    /* الخلفية + النبضة كافيان */
  }

  try {
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG)
  } catch {
    /* اختياري */
  }

  await heartbeatPing(tripId)

  return { background: true }
}

export async function stopTrackingLocalOnly() {
  stopHeartbeat(true)

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
