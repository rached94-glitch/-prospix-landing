import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target:        'http://localhost:3001',
        changeOrigin:  true,
        ws:            false,
        // Garde la connexion SSE ouverte sans timeout côté proxy
        proxyTimeout:  0,
        timeout:       0,
      },
    },
  },
  optimizeDeps: {
    include: ['@react-pdf/renderer'],
  },
  build: {
    commonjsOptions: {
      include: [/@react-pdf\/renderer/, /node_modules/],
    },
  },
})
