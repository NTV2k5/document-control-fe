import { authenticationStore } from 'reactjs-platform/utilities/store/store-authentication/authentication.store';

export const getAccessTokenSelector = (): string | null => {
  return authenticationStore.getState().accessToken;
};
