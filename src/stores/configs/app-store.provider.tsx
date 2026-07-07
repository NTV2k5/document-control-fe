'use client';

import type { StoreApi } from 'zustand';
import type { IAppStoreProviderProps } from './app-store.type';
import { useRef } from 'react';
import { AppStoreContext } from './app-store.context';
import { createAppStore, initStore, type Store } from './configure.store';

export const AppStoreProvider = ({ children }: IAppStoreProviderProps) => {
  const storeRef = useRef<StoreApi<Store> | null>(null);

  if (!storeRef.current) {
    storeRef.current = createAppStore(initStore());
  }

  return <AppStoreContext value={storeRef.current}>{children}</AppStoreContext>;
};
