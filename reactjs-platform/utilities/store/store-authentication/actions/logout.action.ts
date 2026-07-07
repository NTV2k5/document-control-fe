import { CONFIGURATION } from 'reactjs-platform/utilities/constants';
import { CookieService } from 'reactjs-platform/utilities/cookie-storage';
import { CoreUserProfileStore } from '../../store-user-profile';
import { authenticationStore } from '../authentication.store';

export const logoutAction = (): void => {
  CookieService.removeItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY);

  CookieService.removeItem(CONFIGURATION.REFRESH_TOKEN_LS_KEY);

  // LocalStorageService.removeItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY);

  // LocalStorageService.removeItem(CONFIGURATION.REFRESH_TOKEN_LS_KEY);

  authenticationStore.setState({
    isAuthenticated: false,
    accessToken: null,
    refreshToken: null,
    fetchingAuthenticationError: null,
    isFetchingAuthentication: false,
  });

  CoreUserProfileStore.updateProfileAction(undefined);

  CookieService.removeItem('access_token');

  // Redirect to sign-in page after logout
  if (typeof window !== 'undefined') {
    window.location.href = '/sign-in';
  }
};
