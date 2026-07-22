import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // '/' للويب (Vercel) حتى لا تنكسر الأصول عند المسارات المتداخلة مثل /office/bookings
  // بناء الأندرويد يمرّر --base ./ عبر سكربت build:android
  base: '/',
  plugins: [react(), tailwindcss()],
})
