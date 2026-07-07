import { APP_CONFIG } from './app-config.util';

export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://localhost:5002';
};

export const getI18nPath = (url: string, locale: string) => {
  if (locale === APP_CONFIG.defaultLocale) {
    return url;
  }

  return `/${locale}${url}`;
};
