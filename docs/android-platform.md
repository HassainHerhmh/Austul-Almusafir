# تطبيق أسطول المسافر (المنصة) — Android APK

هذا **ليس** تطبيق تتبع السائق في مجلد `mobile/`.

| | منصة الويب (هذا الملف) | تطبيق السائق |
|---|---|---|
| المجلد | جذر المشروع + `android/` | `mobile/` |
| الحزمة | `com.ostool.almosafer.platform` | `com.ostool.almosafer.driver` |
| المحتوى | نفس واجهة الويب (إدارة/مكاتب) | تتبع الموقع للسائق |

## المتطلبات

- Node.js 20+
- Android Studio (SDK + JDK 17+)
- اتصال بالـ API: `https://api.ostool-almosafer.com`

## أوامر البناء

```bash
# بناء الويب ومزامنة Capacitor
npm run build:android

# فتح Android Studio
npm run open:android

# APK تجريبي (Windows)
npm run apk:debug
```

مسار الـ APK بعد البناء الناجح:

`android/app/build/outputs/apk/debug/app-debug.apk`

## ملاحظات الجوال

- القائمة الجانبية تصبح درج (hamburger) على الشاشات الصغيرة.
- الجداول قابلة للتمرير أفقياً حتى تظهر النصوص كاملة.
- التنزيلات (Excel/PDF) تُوجَّه لمجلد التنزيلات عبر WebView.
- الروابط الخارجية (واتساب/خرائط) تُفتح خارج التطبيق.

## إصدار موقّع (release)

من Android Studio: **Build → Generate Signed Bundle / APK** بعد إعداد keystore.
