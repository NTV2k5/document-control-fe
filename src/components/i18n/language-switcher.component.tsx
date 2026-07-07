import { Languages } from 'lucide-react';
import { cn } from '../../lib';
import { SUPPORTED_LOCALES, type TLocale, useTranslation } from '../../i18n';

type TLanguageSwitcherProps = {
  className?: string;
  compact?: boolean;
};

const localeLabel: Record<TLocale, string> = {
  vi: 'VI',
  en: 'EN',
};

export const LanguageSwitcher = ({ className, compact = false }: TLanguageSwitcherProps) => {
  const { locale, setLocale, t } = useTranslation();

  return (
    <fieldset
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm',
        className,
      )}>
      <legend className="sr-only">{t('language.label')}</legend>
      {!compact && <Languages className="ml-1 size-3.5 text-slate-500" aria-hidden="true" />}
      {SUPPORTED_LOCALES.map((item) => {
        const is_active = item === locale;

        return (
          <button
            key={item}
            type="button"
            onClick={() => setLocale(item)}
            className={cn(
              'inline-flex h-7 min-w-9 items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors disabled:cursor-default',
              is_active
                ? 'bg-[#0B2559] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
            aria-pressed={is_active}
            title={t(is_active ? 'language.current' : 'language.switchTo', {
              language: item === 'vi' ? t('language.vietnamese') : t('language.english'),
            })}>
            {localeLabel[item]}
          </button>
        );
      })}
    </fieldset>
  );
};
