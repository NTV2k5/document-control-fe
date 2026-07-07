import type { ILoginCredentials } from '../authentication.types';
import { loginAPI } from 'reactjs-platform/utilities/api';
import { CONFIGURATION } from 'reactjs-platform/utilities/constants';
import { CookieService } from 'reactjs-platform/utilities/cookie-storage';
import { CoreUserProfileStore } from '../../store-user-profile';
import { authenticationStore } from '../authentication.store';

export const loginAction = async (credentials: ILoginCredentials): Promise<boolean> => {
  const setState = authenticationStore.setState;

  try {
    setState({ isFetchingAuthentication: true, fetchingAuthenticationError: null });

    const { username, password } = credentials;

    const data = await loginAPI(username, password);

    const { refresh_token: refreshToken, access_token: accessToken } = data;

    CookieService.setAccessToken(accessToken);

    CookieService.setRefreshToken(refreshToken);

    // setApiAccessToken();

    // LocalStorageService.setItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY, accessToken);

    // LocalStorageService.setItem(CONFIGURATION.REFRESH_TOKEN_LS_KEY, refreshToken);

    setState({
      isFetchingAuthentication: false,
      isAuthenticated: true,
      accessToken,
      refreshToken,
      fetchingAuthenticationError: null,
    });

    await CoreUserProfileStore.fetchProfileAction();

    return true;
  } catch (err) {
    // LocalStorageService.removeItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY);

    // LocalStorageService.removeItem(CONFIGURATION.REFRESH_TOKEN_LS_KEY);

    CookieService.removeItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY);

    CookieService.removeItem(CONFIGURATION.REFRESH_TOKEN_LS_KEY);

    setState({
      isFetchingAuthentication: false,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      fetchingAuthenticationError: (err as Error).message || 'An error occurred during login',
    });

    return false;
  }
};

export const loginActionNoAPI = async (credentials: {
  accessToken: string;
  refreshToken: string;
}): Promise<boolean> => {
  const setState = authenticationStore.setState;

  try {
    setState({ isFetchingAuthentication: true, fetchingAuthenticationError: null });

    const { accessToken, refreshToken } = credentials;

    CookieService.setAccessToken(accessToken);

    CookieService.setRefreshToken(refreshToken);

    // LocalStorageService.setItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY, accessToken);

    // LocalStorageService.setItem(CONFIGURATION.REFRESH_TOKEN_LS_KEY, refreshToken);

    setState({
      isFetchingAuthentication: false,
      isAuthenticated: true,
      accessToken,
      refreshToken,
      fetchingAuthenticationError: null,
    });

    await CoreUserProfileStore.fetchProfileAction();

    return true;
  } catch (err) {
    // LocalStorageService.removeItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY);

    // LocalStorageService.removeItem(CONFIGURATION.REFRESH_TOKEN_LS_KEY);

    CookieService.removeItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY);

    CookieService.removeItem(CONFIGURATION.REFRESH_TOKEN_LS_KEY);

    setState({
      isFetchingAuthentication: false,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      fetchingAuthenticationError: (err as Error).message || 'An error occurred during login',
    });

    return false;
  }
};

export const isLoginLoading = (): boolean => {
  return authenticationStore((state) => state.isFetchingAuthentication);
};

export const getLoginError = (): string | null => {
  return authenticationStore.getState().fetchingAuthenticationError;
};
