import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      useCredentials: true,
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: 'Попутка ИИ',
        short_name: 'Попутка',
        start_url: '/taksi/',
        id: '/taksi/',
        theme_color: '#1565c0',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/taksi/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/taksi/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  base: '/taksi/',
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@mui') || id.includes('@emotion')) {
              return 'vendor-mui';
            }
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            return 'vendor';
          }
        },
      },
    },
  },
})
