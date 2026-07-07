import type { StateCreator } from 'zustand';
import type { Store } from '../configs/configure.store';

export type AppState = {
  isLoading: boolean;
};

export type AppActions = {
  setIsLoading: (isLoading: AppState['isLoading']) => void;
  resetAppState: () => void;
};

export type AppSlice = AppState & AppActions;

export const initialAppState: AppState = {
  isLoading: false,
};

export const createAppSlice: StateCreator<Store, [], [], AppSlice> = (set) => ({
  ...initialAppState,
  setIsLoading: (isLoading) => set({ isLoading }),
  resetAppState: () => set(initialAppState),
});
