import { createStart } from '@tanstack/react-start';

if (import.meta.env.DEV) {
  import('react-grab');
  import('@react-grab/mcp/client');
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const { worker } = await import('./mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
  });
}

export const startInstance = createStart(() => ({}));
