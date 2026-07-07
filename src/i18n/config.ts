import type { TLocale } from './types';

export const DEFAULT_LOCALE: TLocale = 'vi';
export const SUPPORTED_LOCALES: TLocale[] = ['vi', 'en'];
export const LOCALE_STORAGE_KEY = 'document-portal-locale';
export const LOCALE_CHANGED_EVENT = 'document-portal-locale-changed';

const localeSet = new Set<string>(SUPPORTED_LOCALES);

export function isSupportedLocale(value: unknown): value is TLocale {
  return typeof value === 'string' && localeSet.has(value);
}

export function resolveLocale(value: unknown): TLocale {
  if (isSupportedLocale(value)) return value;
  if (typeof value === 'string') {
    const shortLocale = value.split('-')[0];
    if (isSupportedLocale(shortLocale)) return shortLocale;
  }
  return DEFAULT_LOCALE;
}

export function getBrowserLocale(): TLocale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  return resolveLocale(navigator.language || navigator.languages?.[0]);
}

export function getStoredLocale(): TLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  try {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return storedLocale ? resolveLocale(storedLocale) : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function persistLocale(locale: TLocale) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage errors. The active in-memory locale still works.
  }
}

export function notifyLocaleChanged(locale: TLocale) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent(LOCALE_CHANGED_EVENT, {
      detail: { locale },
    }),
  );
}

export function toIntlLocale(locale: TLocale) {
  return locale === 'vi' ? 'vi-VN' : 'en-US';
}
