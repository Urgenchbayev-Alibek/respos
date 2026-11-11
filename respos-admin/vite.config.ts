/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Same rule as `src/shared/config/env.ts`: an http(s) URL, or a root-relative path (same-origin API). */
const SERVICE_URL = /^(?:https?:\/\/|\/(?!\/))/i;

export default defineConfig(({ mode }) => {
  const viteEnv = loadEnv(mode, process.cwd(), 'VITE_');
  // Fail the build instead of shipping a bundle that cannot reach the API. Typical cause on Windows: Git Bash
  // rewrites `VITE_API_BASE_URL=/api/v1` into `C:/Program Files/Git/api/v1` unless MSYS_NO_PATHCONV=1 is set.
  for (const key of ['VITE_API_BASE_URL', 'VITE_HUB_URL']) {
    const value = viteEnv[key];
    if (value && !SERVICE_URL.test(value)) {
      throw new Error(`${key}="${value}" must be an http(s) URL or a root-relative path such as /api/v1`);
    }
  }
  // Desktop shell build (`respos-desktop`): the shell replaces the bundled files itself, so a service worker would
  // only serve stale assets after an upgrade. `disable` = no sw.js, no manifest, registration stubs only.
  const isDesktopBuild = viteEnv.VITE_DESKTOP === 'true';
  return {
    plugins: [
      react(),
      // PWA: precache the built app shell only. No runtime caching: /api and SignalR hubs always go to the network.
      VitePWA({
        disable: isDesktopBuild,
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'RestaurantOS',
          short_name: 'RestaurantOS',
          description: 'RestaurantOS — POS, kitchen, cashier and stock workspaces',
          lang: 'ru',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#f8fafc',
          theme_color: '#E85D2A',
          icons: [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/hubs\//, /^\/swagger/],
          runtimeCaching: [],
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173 },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            data: ['@tanstack/react-query', 'react-hook-form', '@hookform/resolvers', 'zod'],
            i18n: ['i18next', 'react-i18next'],
            signalr: ['@microsoft/signalr'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: { modules: { classNameStrategy: 'non-scoped' } },
      env: {
        VITE_API_BASE_URL: 'http://api.test/api/v1',
        VITE_HUB_URL: 'http://api.test/hubs/restaurant',
      },
    },
  };
});
