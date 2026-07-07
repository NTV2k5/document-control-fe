import { createStart } from '@tanstack/react-start';

if (import.meta.env.DEV) {
  import('react-grab');
  import('@react-grab/mcp/client');
}

export const startInstance = createStart(() => ({}));
