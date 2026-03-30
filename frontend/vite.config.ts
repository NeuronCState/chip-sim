import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8005,
    strictPort: false,
    host: '0.0.0.0',
    allowedHosts: ['frp-put.com'],
    proxy: {
      '/ws': {
        target: 'ws://localhost:8006',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:8006',
      },
      '/health': {
        target: 'http://localhost:8006',
      },
    },
  },
})
