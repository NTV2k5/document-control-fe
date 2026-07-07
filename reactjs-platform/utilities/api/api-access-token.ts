import { CONFIGURATION } from '../constants';
import { CookieService } from '../cookie-storage';
import { LocalStorageService } from '../local-storage';
import { API } from './api';

export const setApiAccessToken = () => {
  const accessToken =
    CookieService.getItem('access_token') || LocalStorageService.getItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY);

  API.defaults.headers = API.defaults.headers || {};

  API.defaults.headers.common = API.defaults.headers.common || {};

  if (accessToken) {
    API.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  } else {
    delete API.defaults.headers.common.Authorization;
  }
};
