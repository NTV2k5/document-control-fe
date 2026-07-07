import { authenticationStore } from 'reactjs-platform/utilities/store/store-authentication/authentication.store';

export const getIsAuthenticatedSelector = (): boolean => {
  return authenticationStore.getState().isAuthenticated;
};
