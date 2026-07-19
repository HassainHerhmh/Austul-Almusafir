import * as Notifications from 'expo-notifications'
import { AppState, Platform } from 'react-native'
import { getActiveTripId, setActiveTripId, stopTracking } from './api'
import {
  ensureTrackingRunning,
  heartbeatPing,
  isBackgroundTrackingRunning,
  stopBackgroundTracking,
} from './tracking'

export const TRACKING_CHANNEL = 'austul-tracking-v2'
export const TRACKING_CATEGORY = 'austul-tracking-controls'
export const STOP_ACTION = 'STOP_TRACKING'
const NOTIF_ID = 'austul-tracking-ongoing'
const GUARD_MS = 15000

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

let listenersReady = false
let guardTimer: ReturnType<typeof setInterval> | null = null
let guardLabel = ''
let guardEnabled = false
let appStateSub: { remove: () => void } | null = null

export async function setupTrackingNotifications(onStopped?: () => void) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(TRACKING_CHANNEL, {
      name: 'تتبع الرحلة (ثابت)',
      importance: Notifications.AndroidImportance.MAX,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
      vibrationPattern: [0],
      enableVibrate: false,
      showBadge: false,
      // يمنع النظام من تجميع/إخفاء الإشعار بسهولة
      enableLights: false,
    })
  }

  await Notifications.setNotificationCategoryAsync(TRACKING_CATEGORY, [
    {
      identifier: STOP_ACTION,
      buttonTitle: 'إيقاف التتبع',
      options: {
        opensAppToForeground: true,
        isDestructive: true,
        isAuthenticationRequired: false,
      },
    },
  ])

  if (!listenersReady) {
    listenersReady = true
    Notifications.addNotificationResponseReceivedListener((response) => {
      const action = response.actionIdentifier
      // الإيقاف فقط من زر «إيقاف التتبع» — الضغط العادي يفتح التطبيق ولا يوقف
      if (action !== STOP_ACTION) return

      void (async () => {
        guardEnabled = false
        stopNotificationGuard()
        const tripId = await getActiveTripId()
        if (tripId) {
          try {
            await stopTracking(tripId)
          } catch {
            /* ignore */
          }
        }
        await stopBackgroundTracking()
        await setActiveTripId(null)
        await hideTrackingNotification()
        onStopped?.()
      })()
    })
  }

  if (Platform.OS === 'android') {
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') {
      throw new Error('يجب السماح بالإشعارات لإظهار حالة التتبع في الشريط')
    }
  }
}

async function presentSticky(tripLabel: string) {
  // نفس المعرّف = تحديث الإشعار دون حذفه ثم إعادة إنشائه
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIF_ID,
    content: {
      title: 'تتبع الرحلة شغال',
      body: `${tripLabel} — اضغط «إيقاف التتبع» للإيقاف فقط`,
      sticky: true,
      autoDismiss: false,
      categoryIdentifier: TRACKING_CATEGORY,
      ...(Platform.OS === 'android'
        ? {
            channelId: TRACKING_CHANNEL,
            priority: Notifications.AndroidNotificationPriority.MAX,
            sticky: true,
          }
        : {}),
    },
    trigger: null,
  })
}

export async function showTrackingNotification(tripLabel: string) {
  guardLabel = tripLabel
  await presentSticky(tripLabel)
}

export async function hideTrackingNotification() {
  stopNotificationGuard()
  try {
    // لا نستخدم dismissAll — حتى لا نلمس إشعار خدمة الموقع الأمامية
    await Notifications.dismissNotificationAsync(NOTIF_ID)
  } catch {
    /* ignore */
  }
}

async function ourNotificationVisible() {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync()
    return presented.some(
      (n) =>
        n.request.identifier === NOTIF_ID ||
        (n.request.content.title || '').includes('تتبع الرحلة'),
    )
  } catch {
    return false
  }
}

async function guardTick() {
  if (!guardEnabled) return

  const tripId = await getActiveTripId()
  if (!tripId) {
    guardEnabled = false
    stopNotificationGuard()
    await hideTrackingNotification()
    return
  }

  try {
    const running = await isBackgroundTrackingRunning()
    if (!running) {
      await ensureTrackingRunning(tripId)
    } else {
      // نبضة للمنصة حتى لو GPS لم يُبلّغ بحركة (يمنع حالة «انقطع» والإشعار شغال)
      await heartbeatPing(tripId)
    }
  } catch {
    try {
      await heartbeatPing(tripId)
    } catch {
      /* أعد المحاولة في الدورة التالية */
    }
  }

  const visible = await ourNotificationVisible()
  if (!visible && guardLabel) {
    // أُزيل الإشعار رغم أن التتبع نشط → أعد عرضه فوراً (غير مسموح مسحه)
    await presentSticky(guardLabel)
  }
}

/** حارس: يعيد الإشعار والتتبع طالما الرحلة نشطة */
export function startNotificationGuard(tripLabel: string) {
  guardLabel = tripLabel
  guardEnabled = true
  stopNotificationGuard(false)

  void guardTick()
  guardTimer = setInterval(() => {
    void guardTick()
  }, GUARD_MS)

  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && guardEnabled) {
        void guardTick()
      }
    })
  }
}

export function stopNotificationGuard(clearFlag = true) {
  if (guardTimer) {
    clearInterval(guardTimer)
    guardTimer = null
  }
  if (clearFlag) {
    guardEnabled = false
  }
  if (clearFlag && appStateSub) {
    appStateSub.remove()
    appStateSub = null
  }
}
