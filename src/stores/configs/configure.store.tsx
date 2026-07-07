import { createStore } from 'zustand/vanilla';
import { type AppSlice, type AppState, createAppSlice } from '../slices';
import { defaultState } from './default-state.store';

export type Store = AppSlice;

export const initStore = (): AppState => {
  return defaultState;
};

export const createAppStore = (initState: AppState = defaultState) => {
  return createStore<Store>()((set, get, store) => ({
    ...initState,
    ...createAppSlice(set, get, store),
  }));
};
