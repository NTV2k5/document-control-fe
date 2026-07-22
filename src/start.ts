import { createStart } from '@tanstack/react-start';

if (import.meta.env.DEV) {
  import('react-grab');
  import('@react-grab/mcp/client');
}

// MSW disabled — all API calls go to the real backend via Vite proxy
// Uncomment the block below to re-enable mock service worker:
// if (import.meta.env.DEV && typeof window !== 'undefined') {
//   const { worker } = await import('./mocks/browser');
//   await worker.start({ onUnhandledRequest: 'bypass' });
// }

export const startInstance = createStart(() => ({}));
