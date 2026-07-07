import { DEFAULT_LOCALE } from './config';
import { dictionaries } from './locales';
import type { TLocale, TTranslationDictionary, TTranslationParams } from './types';

function getValue(dictionary: TTranslationDictionary, key: string): string | undefined {
  const value = key.split('.').reduce<string | TTranslationDictionary | undefined>((current, segment) => {
    if (!current || typeof current === 'string') return undefined;
    return current[segment];
  }, dictionary);

  return typeof value === 'string' ? value : undefined;
}

function interpolate(value: string, params?: TTranslationParams) {
  if (!params) return value;

  return value.replace(/\{\{(\w+)\}\}/g, (_, paramKey: string) => {
    const paramValue = params[paramKey];
    return paramValue == null ? '' : String(paramValue);
  });
}

export function translate(locale: TLocale, key: string, params?: TTranslationParams) {
  const dictionary = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  const fallbackDictionary = dictionaries[DEFAULT_LOCALE];
  const value = getValue(dictionary, key) ?? getValue(fallbackDictionary, key) ?? key;
  return interpolate(value, params);
}
