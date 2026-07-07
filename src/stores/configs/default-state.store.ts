import { type AppState, initialAppState } from '../slices';

export type StoreState = AppState;

export const defaultState: AppState = {
  ...initialAppState,
};
