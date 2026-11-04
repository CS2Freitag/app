import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: '/app/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        injectRegister: null,
        registerType: 'autoUpdate',
        manifest: {
          id: '/app/',
          name: 'CS2Freitag - Counter-Strike 2 Callouts',
          short_name: 'CS2Freitag',
          description: 'Moderne PWA für CS2 Callouts aller offiziellen Karten mit interaktiver Taktik-Karte, Offline-Funktion, Suche und Favoriten.',
          theme_color: '#09090b',
          background_color: '#09090b',
          display: 'standalone',
          display_override: ['standalone', 'window-controls-overlay'],
          orientation: 'any',
          start_url: '/app/',
          scope: '/app/',
          lang: 'de',
          categories: ['games', 'utilities'],
          icons: [
            {
              src: '/app/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/app/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/app/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          screenshots: [
            {
              src: '/app/screenshot-desktop.png',
              sizes: '1280x720',
              type: 'image/png',
              form_factor: 'wide',
              label: 'CS2Freitag Taktik-Übersicht & Callouts (Desktop)'
            },
            {
              src: '/app/screenshot-mobile.png',
              sizes: '1080x1920',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'CS2Freitag Mobile Ansicht'
            }
          ]
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MiB
          globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2}', 'pwa-*.png', 'apple-touch-icon.png', 'screenshot-*.png', 'ct.png', 'T.png', 'manifest.json'],
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'cs2-maps-cache',
                expiration: {
                  maxEntries: 150,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
            {
              urlPattern: ({ request }) =>
                request.destination === 'script' ||
                request.destination === 'style' ||
                request.destination === 'worker',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'cs2-static-resources',
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
