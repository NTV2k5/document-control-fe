import { en } from './en';
import { vi } from './vi';
import type { TLocale, TTranslationDictionary } from '../types';

export const dictionaries: Record<TLocale, TTranslationDictionary> = {
  vi,
  en,
};
