/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Política de seguridad (solo en la versión publicada; en desarrollo Vite necesita scripts en línea).
 * Solo se ejecuta código propio; las imágenes vienen únicamente de Wikimedia; las fuentes van
 * dentro de la app; la única conexión extra es el servidor que presenta a los teléfonos de una sala.
 */
const csp = (peerHost: string) =>
  [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https://upload.wikimedia.org https://thumb.wikimedia.org",
    `connect-src 'self' https://upload.wikimedia.org https://thumb.wikimedia.org https://${peerHost} wss://${peerHost}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');

/** Servidor de encuentro de las salas (el público de PeerJS, salvo que se configure otro). */
const peerHost = (env: Record<string, string>) => (env.VITE_PEER_HOST ? `${env.VITE_PEER_HOST}${env.VITE_PEER_PORT ? `:${env.VITE_PEER_PORT}` : ''}` : '0.peerjs.com');

const securityHeaders = (CSP: string): Plugin => ({
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

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    securityHeaders(csp(peerHost(loadEnv(mode, process.cwd(), 'VITE_')))),
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
            // Las fotos se piden con CORS: así se guarda la imagen real y no una respuesta opaca.
            urlPattern: /^https:\/\/(upload|thumb)\.wikimedia\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wiki-img-v2',
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: 'node' },
}));
