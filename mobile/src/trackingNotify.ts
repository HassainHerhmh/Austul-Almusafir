import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { getActiveTripId, setActiveTripId, stopTracking } from './api'
import { stopBackgroundTracking } from './tracking'

export const TRACKING_CHANNEL = 'austul-tracking'
export const TRACKING_CATEGORY = 'austul-tracking-controls'
export const STOP_ACTION = 'STOP_TRACKING'
const NOTIF_ID = 'austul-tracking-ongoing'

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

export async function setupTrackingNotifications(
  onStopped?: () => void,
) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(TRACKING_CHANNEL, {
      name: 'تتبع الرحلة',
      importance: Notifications.AndroidImportance.MAX,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
      vibrationPattern: [0],
      enableVibrate: false,
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
      if (action === STOP_ACTION || action === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        if (action === STOP_ACTION) {
          void (async () => {
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
        }
      }
    })
  }

  if (Platform.OS === 'android') {
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') {
      throw new Error('يجب السماح بالإشعارات لإظهار حالة التتبع في الشريط')
    }
  }
}

export async function showTrackingNotification(tripLabel: string) {
  await Notifications.dismissNotificationAsync(NOTIF_ID).catch(() => undefined)
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIF_ID,
    content: {
      title: 'تتبع الرحلة شغال',
      body: `${tripLabel} — اضغط «إيقاف التتبع» للإيقاف`,
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

export async function hideTrackingNotification() {
  try {
    await Notifications.dismissNotificationAsync(NOTIF_ID)
  } catch {
    /* ignore */
  }
  try {
    await Notifications.dismissAllNotificationsAsync()
  } catch {
    /* ignore */
  }
}
