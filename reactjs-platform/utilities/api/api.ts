import type { ApiError } from '.';
import axios, { type InternalAxiosRequestConfig } from 'axios';
import { API_ENDPOINT, CONFIGURATION } from '../constants';
import { LocalStorageService } from '../local-storage';
import { CookieService, CoreAuthenticationStore } from 'reactjs-platform/utilities';

const API = axios.create({
  baseURL: `${API_ENDPOINT}`,
  headers: {
    'Content-Type': 'application/json;charset=UTF-8',
  },
});

const APP_LOCALE_STORAGE_KEY = 'document-portal-locale';

const getCurrentLocale = () => {
  if (typeof window === 'undefined') return 'vi';

  try {
    const locale = window.localStorage.getItem(APP_LOCALE_STORAGE_KEY);
    return locale === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
};

const apiFallbackMessages = {
  vi: {
    internalServer: 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.',
    generic: 'Đã xảy ra lỗi. Vui lòng thử lại.',
    request: 'Lỗi request Axios',
  },
  en: {
    internalServer: 'Internal server error. Please try again later.',
    generic: 'Something went wrong. Please try again.',
    request: 'Axios request error',
  },
};

const getApiErrorMessage = (error: ApiError) => {
  const directData = error as { data?: { message?: unknown } };
  const rawMessage = directData.data?.message || error?.response?.data?.message || error?.message;
  if (typeof rawMessage === 'string' && rawMessage.trim()) return rawMessage.trim();
  const messages = apiFallbackMessages[getCurrentLocale()];
  if (error?.response?.status === 500) return messages.internalServer;
  return messages.generic;
};

API.interceptors.request.use(
  (requestConfig) => {
    const token =
      CookieService.getItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY) ||
      CoreAuthenticationStore.getAccessTokenSelector() ||
      LocalStorageService.getItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY);

    if (token) {
      requestConfig.headers = requestConfig.headers || {};
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }

    requestConfig.headers = requestConfig.headers || {};
    requestConfig.headers['Accept-Language'] = getCurrentLocale();

    const serializerConfig = requestConfig;

    if (serializerConfig.headers && serializerConfig.headers['clean-request']?.toLocaleLowerCase() === 'no-clean') {
      return serializerConfig;
    }

    serializerConfig.paramsSerializer = (params) => {
      let result = '';
      Object.keys(params).forEach((key) => {
        if (params[key] == null) {
          return;
        }
        if (typeof params[key] === 'string') {
          const cleaned = params[key].trim().replace(/\s+/g, ' ');
          if (cleaned) {
            result += `${key}=${encodeURIComponent(cleaned)}&`;
          }
        } else {
          result += `${key}=${encodeURIComponent(params[key])}&`;
        }
      });
      return result.slice(0, -1);
    };

    try {
      const contentType = serializerConfig.headers?.['Content-Type'];

      if (typeof contentType === 'string' && contentType.includes('application/json')) {
        const bodyJsonData = serializerConfig.data;
        if (bodyJsonData) {
          Object.keys(bodyJsonData).forEach((key) => {
            if (typeof bodyJsonData[key] === 'string') {
              bodyJsonData[key] = bodyJsonData[key].trim().replace(/\s+/g, ' ');
            }
          });
          serializerConfig.data = JSON.stringify(bodyJsonData);
        }
      } else if (typeof contentType === 'string' && contentType.includes('application/x-www-form-urlencoded')) {
        const bodyFormData: URLSearchParams = serializerConfig.data;
        bodyFormData?.forEach((value, key) => {
          bodyFormData.set(key, value.trim().replace(/\s+/g, ' '));
        });
        serializerConfig.data = bodyFormData;
      }
    } catch {
      // Keep request cleanup failures non-blocking; callers handle user-facing errors.
    }

    return serializerConfig;
  },
  (error) => {
    return Promise.reject(error);
  },
);

API.interceptors.response.use(
  (response) => response,
  async (error: ApiError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; skipToast?: boolean };

    // Check if the error is due to request cancellation (abort)
    const isAbortError =
      error?.name === 'AbortError' || error?.code === 'ERR_CANCELED' || error?.message?.includes('canceled');

    // For abort errors, just reject without showing toast or further processing
    if (isAbortError) {
      return Promise.reject(error);
    }

    const message = getApiErrorMessage(error);

    if (error?.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const isAuthenticated = CoreAuthenticationStore.getIsAuthenticatedSelector();

      if (!isAuthenticated) {
        return Promise.reject(new Error(message));
      }

      originalRequest._retry = true;

      const newToken = await CoreAuthenticationStore.refreshAccessToken();
      if (newToken) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return API(originalRequest);
      }

      CoreAuthenticationStore.logoutAction();

      return Promise.reject(new Error(message));
    }

    throw new Error(message);
  },
);

const ThrowApiError = (error: ApiError) => {
  if (error.isAxiosError) {
    throw error.response?.data.code;
  }
  throw error;
};

export { API, ThrowApiError };
