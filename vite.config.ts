import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Política de seguridad (solo en la versión publicada; en desarrollo Vite necesita scripts en línea).
 * Solo se ejecuta código propio; las imágenes vienen únicamente de Wikimedia; sin formularios ni iframes.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://upload.wikimedia.org https://thumb.wikimedia.org",
  "connect-src 'self' https://upload.wikimedia.org https://thumb.wikimedia.org https://fonts.googleapis.com https://fonts.gstatic.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const securityHeaders = (): Plugin => ({
  name: 'security-meta',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />`,
    ),
});

export default defineConfig({
  base: './',
  plugins: [
    react(),
    securityHeaders(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'IMPOSTOR — ¿Quién miente?',
        short_name: 'Impostor',
        description: 'Juego de fiesta: descubre al impostor pasando el celular.',
        lang: 'es',
        start_url: '.',
        scope: '.',
        display: 'fullscreen',
        orientation: 'portrait',
        background_color: '#07060b',
        theme_color: '#07060b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-z]+\.wikipedia\.org\/api\/rest_v1\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'wiki-api',
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/(upload|thumb)\.wikimedia\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wiki-img',
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: 'node' },
});
