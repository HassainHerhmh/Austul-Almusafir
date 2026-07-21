import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

function isExternalHttpUrl(href: string): boolean {
  try {
    const url = new URL(href, window.location.href)
    if (!/^https?:$/i.test(url.protocol)) return false
    // أصول التطبيق داخل Capacitor
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return false
    if (url.origin === window.location.origin) return false
    return true
  } catch {
    return false
  }
}

/** تهيئة Capacitor عند التشغيل داخل APK */
export async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return

  try {
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#0f3d4c' })
  } catch {
    /* ignore */
  }

  try {
    await SplashScreen.hide()
  } catch {
    /* ignore */
  }

  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back()
    } else {
      void App.exitApp()
    }
  })

  document.addEventListener(
    'click',
    (e) => {
      const el = e.target as HTMLElement | null
      const a = el?.closest?.('a') as HTMLAnchorElement | null
      if (!a?.href) return
      const href = a.href
      const forceExternal =
        a.target === '_blank' ||
        /wa\.me|whatsapp|maps\.google|google\.com\/maps|tel:|mailto:/i.test(href)
      if (forceExternal || isExternalHttpUrl(href)) {
        if (/^https?:/i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) {
          e.preventDefault()
          void Browser.open({ url: href })
        }
      }
    },
    true,
  )
}
