import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// The `/api` proxy mirrors the Azure Static Web Apps runtime, where the managed
// Functions are served from the same origin under `/api`. Run `func start` in ./api
// (or use the SWA CLI) alongside `npm run dev`.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:7071',
        changeOrigin: true,
      },
    },
  },
})

