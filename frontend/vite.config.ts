import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 7879,
    https: (() => {
      try {
        const keyPath = path.resolve(__dirname, '../nodejs/ssl/key.pem');
        const certPath = path.resolve(__dirname, '../nodejs/ssl/cert.pem');
        
        if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
          return {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
          };
        }
      } catch (error) {
        console.warn('SSL certificates not found, falling back to HTTP');
      }
      return false; // Fallback to HTTP
    })(),
    proxy: {
      '/api': {
        target: 'https://localhost:8448',
        changeOrigin: true,
        secure: false, // Allow self-signed certificates
        ws: true, // Enable WebSocket proxying for SSE
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  build: {
    outDir: 'build',
    sourcemap: true,
  },
}) 