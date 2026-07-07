'use client';

import type { StoreApi } from 'zustand';
import type { Store } from './configure.store';
import { createContext } from 'react';

export const AppStoreContext = createContext<StoreApi<Store> | null>(null);
