/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relativní base ('./') funguje na GitHub Pages (podadresář) i na Vercelu (kořen).
export default defineConfig({
  base: './',
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      // nová verze se aplikuje řízeně (src/app/updates.ts): na pozadí hned, v popředí přes lištu
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Questy života',
        short_name: 'Questy',
        description: 'Gamifikovaný systém seberozvoje ve stylu RPG',
        lang: 'cs',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b0d14',
        theme_color: '#0b0d14',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // notifikace (public/push-sw.js)
        importScripts: ['push-sw.js'],
        // Python pro modul Programování – po prvním stažení funguje i offline
        runtimeCaching: [{
          urlPattern: ({ url }) => url.href.startsWith('https://cdn.jsdelivr.net/npm/pyodide@'),
          handler: 'CacheFirst',
          options: { cacheName: 'pyodide', expiration: { maxEntries: 40 }, cacheableResponse: { statuses: [0, 200] } },
        }],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 800 },
  worker: { format: 'es' },
  test: {
    environment: 'node',
  },
});
