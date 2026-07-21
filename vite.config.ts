import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // مسارات نسبية حتى يعمل البناء داخل Capacitor WebView
  base: './',
  plugins: [react(), tailwindcss()],
})
