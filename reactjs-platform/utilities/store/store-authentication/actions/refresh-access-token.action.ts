import { refreshTokenAPI } from 'reactjs-platform/utilities/api';
import { CookieService } from 'reactjs-platform/utilities/cookie-storage';
import { CoreUserProfileStore } from '../../store-user-profile';
import { authenticationStore } from '../authentication.store';
import { CONFIGURATION } from 'reactjs-platform/utilities/constants';

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

export const refreshAccessToken = async (): Promise<string | null> => {
  if (isRefreshing) {
    return new Promise((resolve) => {
      refreshSubscribers.push(resolve);
    });
  }

  isRefreshing = true;

  try {
    const oldRefreshToken = authenticationStore.getState().refreshToken;

    if (!oldRefreshToken) {
      throw new Error('Missing refresh token');
    }

    const { access_token, refresh_token } = await refreshTokenAPI(oldRefreshToken);

    CookieService.setAccessToken(access_token);

    CookieService.setRefreshToken(refresh_token);

    // LocalStorageService.setItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY, access_token);

    // LocalStorageService.setItem(CONFIGURATION.REFRESH_TOKEN_LS_KEY, refresh_token);

    // setApiAccessToken();

    authenticationStore.setState({
      isAuthenticated: true,
      accessToken: access_token,
      refreshToken: refresh_token,
      isFetchingAuthentication: false,
      fetchingAuthenticationError: null,
    });

    await CoreUserProfileStore.fetchProfileAction();

    refreshSubscribers.forEach((cb) => cb(access_token));
    refreshSubscribers = [];

    return access_token;
  } catch (err) {
    // LocalStorageService.removeItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY);

    // LocalStorageService.removeItem(CONFIGURATION.REFRESH_TOKEN_LS_KEY);

    CookieService.removeItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY);

    CookieService.removeItem(CONFIGURATION.REFRESH_TOKEN_LS_KEY);

    authenticationStore.setState({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      isFetchingAuthentication: false,
      fetchingAuthenticationError: (err as Error).message,
    });

    return null;
  } finally {
    isRefreshing = false;
  }
};
