import { toIntlLocale } from './config';
import type { TLocale } from './types';

export function formatNumberByLocale(locale: TLocale, value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(toIntlLocale(locale), options).format(value);
}

export function formatDateByLocale(
  locale: TLocale,
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(toIntlLocale(locale), options).format(date);
}
