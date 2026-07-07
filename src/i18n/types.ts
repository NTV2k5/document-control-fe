export type TLocale = 'vi' | 'en';

export type TTranslationParams = Record<string, string | number | boolean | null | undefined>;

export interface TTranslationDictionary {
  [key: string]: string | TTranslationDictionary;
}
