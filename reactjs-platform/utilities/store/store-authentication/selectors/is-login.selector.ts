import { getAccessTokenSelector } from 'reactjs-platform/utilities/store/store-authentication/selectors';
import { checkTokenExpiredUtil } from 'reactjs-platform/utilities/store/store-authentication/util';

export const isLoginSelector = (): boolean => {
  const token = getAccessTokenSelector();
  return !!token && !checkTokenExpiredUtil(token);
};
