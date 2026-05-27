import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    allowedHosts: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.svg', 'offline.html'],
      manifest: {
        name: 'PantrySync',
        short_name: 'PantrySync',
        description: 'Shared grocery list and pantry tracker',
        theme_color: '#3b82f6',
        background_color: '#09090b',
        display: 'standalone',
        start_url: '/app',
        scope: '/',
        orientation: 'portrait',
        icons: [
          {
            src: '/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/maskable-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        importScripts: ['/push-sw.js'],
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,jpg,jpeg,webp,ico}'],
        runtimeCaching: [],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /supabase\.co/],
      },
    }),
  ],
})
