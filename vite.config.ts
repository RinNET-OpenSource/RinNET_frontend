import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

// 本地开发证书（npm run gen:cert 生成）。未生成时退化为普通 http/localhost。
const certFile = path.join(root, 'ssl', 'portal.naominet.live.crt');
const keyFile = path.join(root, 'ssl', 'portal.naominet.live.key');
const hasCert = existsSync(certFile) && existsSync(keyFile);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'assets/turtle.svg'],
      manifest: {
        name: 'RinNet',
        short_name: 'RinNet',
        description: 'RinNET portal',
        theme_color: '#bdcf47',
        background_color: '#fafafa',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          '72x72', '96x96', '128x128', '144x144', '152x152', '192x192', '384x384', '512x512',
        ].map((size) => ({
          src: `assets/icons/turtle-${size}.png`,
          sizes: size,
          type: 'image/png',
          purpose: 'maskable any',
        })),
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,woff,woff2}'],
        navigateFallback: '/index.html',
        // /api 走网络（等价旧版 ngsw 的空缓存 dataGroup），不额外配置 runtimeCaching。
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
    },
  },
  server: hasCert
    ? {
        https: {
          cert: readFileSync(certFile),
          key: readFileSync(keyFile),
        },
        host: true, // 0.0.0.0，允许局域网调试
        port: 443,
        strictPort: false,
        allowedHosts: true, // 等价旧版 disableHostCheck
        proxy: {
          '/api': {
            target: 'http://aqua.naominet.live',
            changeOrigin: true,
          },
          // maimai2 头像上传走原始游戏 servlet 路径，不在 /api 下
          '/Maimai2Servlet': {
            target: 'http://aqua.naominet.live',
            changeOrigin: true,
          },
        },
      }
    : undefined,
});
