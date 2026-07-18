import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import eslint from 'vite-plugin-eslint2';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const targetUrl = env.VITE_API_URL || env.VITE_API_ENDPOINT || 'http://100.106.138.47:8000';

  return {
    envPrefix: ['VITE_', 'TECH_'],
    preview: {
      allowedHosts: ['edu-docs-control-dev.dxfuturetech.com.vn'],
    },
    server: {
      host: true,
      proxy: {
        '/api/method/authen': {
          target: env.VITE_API_ENDPOINT || 'https://erpnext.aurora-tech.com',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('Expect');
            });
          },
        },
        '/api': {
          target: targetUrl,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('Expect');
            });
          },
        },
        '/notifications': {
          target: targetUrl,
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
  };
});
