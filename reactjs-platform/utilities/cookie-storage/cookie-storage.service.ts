import { deleteCookie, getCookie, setCookie } from 'cookies-next';
import { jwtDecode } from 'jwt-decode';
import { CONFIGURATION } from '../constants';

class CookieServiceFactory {
  private static _instance: CookieServiceFactory;

  public static instance(): CookieServiceFactory {
    if (!CookieServiceFactory._instance) {
      CookieServiceFactory._instance = new CookieServiceFactory();
    }
    return CookieServiceFactory._instance;
  }

  private constructor() {}

  public getItem = <T = string>(key: string): T | '' => {
    if (typeof window === 'undefined') {
      return '';
    }
    const value = getCookie(key);
    if (!value) {
      return '';
    }
    try {
      return JSON.parse(value as string) as T;
    } catch {
      return value as unknown as T;
    }
  };

  public setItem = <T = any>(key: string, value: T, options: { maxAge?: number } = {}) => {
    if (typeof window === 'undefined') {
      return;
    }
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    const isSecure = window.location.protocol === 'https:';
    setCookie(key, data, {
      path: '/',
      secure: isSecure,
      sameSite: 'lax',
      ...options,
    });
  };

  public removeItem = (key: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    deleteCookie(key);
  };

  public setAccessToken = (token: string) => {
    if (!token) {
      return;
    }

    let expiresInSeconds = 60 * 60 * 24; // Default to 1 day if not a JWT

    try {
      const decoded = jwtDecode<{ exp?: number }>(token);
      if (decoded.exp) {
        const nowInSeconds = Math.floor(Date.now() / 1000);
        expiresInSeconds = decoded.exp - nowInSeconds;
      }
    } catch {
      console.warn('Failed to decode access token as JWT');
    }

    if (expiresInSeconds <= 0) {
      console.warn('Token expired already');
      return;
    }

    this.setItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY, token, {
      maxAge: expiresInSeconds + 60 * 60 * 24 * 365,
    });
  };

  public setRefreshToken = (refresh_token: string) => {
    if (!refresh_token) {
      return;
    }

    let expiresInSeconds = 60 * 60 * 24 * 30; // Default to 30 days if not a JWT

    try {
      const decoded = jwtDecode<{ exp?: number }>(refresh_token);
      if (decoded.exp) {
        const nowInSeconds = Math.floor(Date.now() / 1000);
        expiresInSeconds = decoded.exp - nowInSeconds;
      }
    } catch {
      console.warn('Failed to decode refresh token as JWT');
    }

    if (expiresInSeconds <= 0) {
      console.warn('Token expired already');
      return;
    }

    this.setItem(CONFIGURATION.REFRESH_TOKEN_LS_KEY, refresh_token, {
      maxAge: expiresInSeconds + 60 * 60 * 24 * 365,
    });
  };
}

export const CookieService = CookieServiceFactory.instance();

if (typeof window !== 'undefined') {
  (window as any).setCookieItem = CookieService.setItem;
  (window as any).getCookieItem = CookieService.getItem;
  (window as any).removeCookieItem = CookieService.removeItem;
}
