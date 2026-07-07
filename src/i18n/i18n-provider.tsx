import type { ReactNode } from 'react';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  getStoredLocale,
  isSupportedLocale,
  LOCALE_CHANGED_EVENT,
  LOCALE_STORAGE_KEY,
  notifyLocaleChanged,
  persistLocale,
  resolveLocale,
  toIntlLocale,
} from './config';
import { translate } from './translation';
import type { TLocale, TTranslationParams } from './types';

type TI18nContextValue = {
  locale: TLocale;
  intlLocale: string;
  setLocale: (locale: TLocale) => void;
  toggleLocale: () => void;
  t: (key: string, params?: TTranslationParams) => string;
};

export const I18nContext = createContext<TI18nContextValue | null>(null);

type TI18nProviderProps = {
  children: ReactNode;
};

export const I18nProvider = ({ children }: TI18nProviderProps) => {
  const [locale, setLocaleState] = useState<TLocale>(() => getStoredLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const handleLocaleChanged = (event: Event) => {
      const nextLocale = (event as CustomEvent<{ locale?: unknown }>).detail?.locale;
      if (isSupportedLocale(nextLocale)) {
        setLocaleState(nextLocale);
      }
    };

    const handleStorageChanged = (event: StorageEvent) => {
      if (event.key !== LOCALE_STORAGE_KEY) return;
      setLocaleState(resolveLocale(event.newValue));
    };

    window.addEventListener(LOCALE_CHANGED_EVENT, handleLocaleChanged);
    window.addEventListener('storage', handleStorageChanged);

    return () => {
      window.removeEventListener(LOCALE_CHANGED_EVENT, handleLocaleChanged);
      window.removeEventListener('storage', handleStorageChanged);
    };
  }, []);

  const setLocale = useCallback((nextLocale: TLocale) => {
    setLocaleState(nextLocale);
    persistLocale(nextLocale);
    notifyLocaleChanged(nextLocale);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((currentLocale) => {
      const nextLocale = currentLocale === 'vi' ? 'en' : 'vi';
      persistLocale(nextLocale);
      notifyLocaleChanged(nextLocale);
      return nextLocale;
    });
  }, []);

  const t = useCallback((key: string, params?: TTranslationParams) => translate(locale, key, params), [locale]);

  const value = useMemo<TI18nContextValue>(
    () => ({
      locale,
      intlLocale: toIntlLocale(locale),
      setLocale,
      toggleLocale,
      t,
    }),
    [locale, setLocale, t, toggleLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
