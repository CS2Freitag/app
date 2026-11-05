import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const isGitHubPages = process.env.GITHUB_ACTIONS === 'true' || mode === 'production_github';
  const base = isGitHubPages ? '/app/' : '/';

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        injectRegister: null,
        registerType: 'autoUpdate',
        manifest: {
          id: base,
          name: 'CS2Freitag - Counter-Strike 2 Callouts',
          short_name: 'CS2Freitag',
          description: 'Moderne PWA für CS2 Callouts aller offiziellen Karten mit interaktiver Taktik-Karte, Offline-Funktion, Suche und Favoriten.',
          theme_color: '#09090b',
          background_color: '#09090b',
          display: 'standalone',
          display_override: ['standalone', 'window-controls-overlay'],
          orientation: 'any',
          start_url: base,
          scope: base,
          lang: 'de',
          categories: ['games', 'utilities'],
          icons: [
            {
              src: `${base}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}pwa-maskable-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          screenshots: [
            {
              src: `${base}screenshot-desktop.png`,
              sizes: '1280x720',
              type: 'image/png',
              form_factor: 'wide',
              label: 'CS2Freitag Taktik-Übersicht & Callouts (Desktop)'
            },
            {
              src: `${base}screenshot-mobile.png`,
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
              handler: 'NetworkFirst',
              options: {
                cacheName: 'cs2-maps-cache-v3',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 150,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
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
                cacheName: 'cs2-static-resources-v3',
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
