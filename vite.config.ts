import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const vercelApiPlugin = () => ({
  name: 'vercel-api-proxy',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url && req.url.startsWith('/api/youtube-transcript')) {
        const handlerPath = path.resolve(__dirname, 'api/youtube-transcript.js');
        if (fs.existsSync(handlerPath)) {
          const { default: handler } = await import('file://' + handlerPath + '?t=' + Date.now());
          
          const urlObj = new URL(req.url, 'http://localhost');
          req.query = Object.fromEntries(urlObj.searchParams);
          
          res.json = function (obj: any) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(obj));
          };
          res.status = function(code: number) {
            res.statusCode = code;
            return res;
          };
          
          try {
            await handler(req, res);
          } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Internal server error' });
          }
          return;
        }
      }
      next();
    });
  }
});

export default defineConfig({
  plugins: [
    react(),
    vercelApiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document' || request.destination === 'script' || request.destination === 'style',
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
              },
            },
          },
        ],
      },
      manifest: {
        name: 'الرفيق الدراسي الذكي',
        short_name: 'Zenith',
        description: 'رفيقك الدراسي المدعوم بالذكاء الاصطناعي والتكرار المتباعد',
        theme_color: '#0040a1',
        background_color: '#fcf9f8',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
})
