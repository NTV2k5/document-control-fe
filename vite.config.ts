import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import eslint from 'vite-plugin-eslint2';

export default defineConfig({
  envPrefix: ['VITE_', 'TECH_'],
  preview: {
    allowedHosts: ['edu-docs-control-dev.dxfuturetech.com.vn'],
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://100.106.138.47:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('Expect');
          });
        },
      },
      '/notifications': {
        target: process.env.VITE_API_URL || 'http://100.106.138.47:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('Expect');
          });
        },
      },
    },
  },
  plugins: [

    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    ...(process.env.NODE_ENV !== 'production'
      ? [
          eslint({
            include: ['src/**/*.{ts,tsx}', 'reactjs-platform/**/*.{ts,tsx}'],
            emitErrorAsWarning: true,
          }),
        ]
      : []),
    tanstackStart({
      srcDirectory: 'src',
      spa: {
        enabled: true,
        maskPath: '/',
        prerender: {
          outputPath: '/_shell',
          crawlLinks: false,
        },
      },
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
      },
    }),
    viteReact(),
  ],
  optimizeDeps: {
    include: ['@turbodocx/html-to-docx'],
  },
});
