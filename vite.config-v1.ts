import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import eslint from 'vite-plugin-eslint2';

// const allowedHosts = ['edu-docs-control-dev.dxfuturetech.com.vn', 'localhost'];

// const allowedHosts = process.env.VITE_ALLOWED_HOSTS
//   ? process.env.VITE_ALLOWED_HOSTS.split(',').map((host) => host.trim())
//   : ['*'];

export default defineConfig({
  preview: {
    allowedHosts: ['edu-docs-control-dev.dxfuturetech.com.vn', 'localhost', '127.0.0.1'],
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['edu-docs-control-dev.dxfuturetech.com.vn', 'localhost', '127.0.0.1'],
  },
  plugins: [
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    ...(process.env.NODE_ENV !== 'production'
      ? [
          eslint({
            include: ['src/**/*.{ts,tsx}', 'shared/**/*.{ts,tsx}'],
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
      // pages: [
      //     { path: "/" },
      //     { path: "/templates/new" },
      //     { path: "/templates/:id" },
      // ],
    }),
    viteReact(),
  ],
  optimizeDeps: {
    include: ['@turbodocx/html-to-docx'],
  },
});
