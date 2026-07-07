import type { Store } from './configure.store';
import { useContext } from 'react';
import { useStore as useZustandStore } from 'zustand';
import { AppStoreContext } from './app-store.context';

export const useStore = <T>(selector: (store: Store) => T): T => {
  const appStoreContext = useContext(AppStoreContext);

  if (!appStoreContext) {
    throw new Error('useStore must be used within AppStoreProvider');
  }

  return useZustandStore(appStoreContext, selector);
};
