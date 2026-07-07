import type { AnyRouter } from '@tanstack/react-router';

export type AppRouterLocal = Pick<AnyRouter, 'navigate' | 'history' | 'invalidate'>;
