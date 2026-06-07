import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    // Proxy API calls to the FastAPI backend during development.
    // Override the target with VITE_PROXY_TARGET when the backend isn't on :8000.
    proxy: {
      '/api': process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
    },
  },
})
