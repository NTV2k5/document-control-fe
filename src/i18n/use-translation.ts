import { useCallback, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, toIntlLocale } from './config';
import { I18nContext } from './i18n-provider';
import { translate } from './translation';
import type { TLocale, TTranslationParams } from './types';

export function useTranslation() {
  const context = useContext(I18nContext);
  const fallbackIntlLocale = toIntlLocale(DEFAULT_LOCALE);
  const fallbackSetLocale = useCallback((_locale: TLocale) => undefined, []);
  const fallbackToggleLocale = useCallback(() => undefined, []);
  const fallbackTranslate = useCallback(
    (key: string, params?: TTranslationParams) => translate(DEFAULT_LOCALE, key, params),
    [],
  );
  const fallbackContext = useMemo(
    () => ({
      locale: DEFAULT_LOCALE,
      intlLocale: fallbackIntlLocale,
      setLocale: fallbackSetLocale,
      toggleLocale: fallbackToggleLocale,
      t: fallbackTranslate,
    }),
    [fallbackIntlLocale, fallbackSetLocale, fallbackToggleLocale, fallbackTranslate],
  );

  if (!context) {
    return fallbackContext;
  }
  return context;
}
