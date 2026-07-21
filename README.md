# أسطول المسافر

## الباك اند (Railway)

مجلد **`backend/`** — API على:
`https://api.ostool-almosafer.com`

## الواجهة (Vercel)

الموقع على:
`https://ostool-almosafer.com`

في Vercel Environment Variable:
`VITE_API_URL` = `https://api.ostool-almosafer.com`

## تطبيق Android للمنصة (APK)

نفس منصة الويب مغلفة بـ Capacitor — انظر [docs/android-platform.md](docs/android-platform.md).

```bash
npm run build:android
npm run apk:debug
```

تطبيق تتبع السائق منفصل في مجلد `mobile/`.
