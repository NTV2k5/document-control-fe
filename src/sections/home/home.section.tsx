import { Link } from '@tanstack/react-router';
import { profileStore, canAccessDocuments, canAccessTemplates, canManageUsers } from 'reactjs-platform/utilities';
import { ArrowRight, FileText, Files, ShieldCheck } from 'lucide-react';
import type React from 'react';
import type { IHomeSectionProps } from './home.type';
import { useTranslation } from '../../i18n';

type THomeShortcut = {
  key: 'templates' | 'documents' | 'admin';
  titleKey: string;
  descriptionKey: string;
  href: '/templates' | '/documents' | '/admin';
  icon: typeof FileText;
  eyebrowKey: string;
  accentClassName: string;
};

const baseShortcuts: THomeShortcut[] = [
  {
    key: 'templates',
    titleKey: 'home.shortcuts.templates.title',
    descriptionKey: 'home.shortcuts.templates.description',
    href: '/templates',
    icon: FileText,
    eyebrowKey: 'home.shortcuts.templates.eyebrow',
    accentClassName: 'from-[#fff7e6] via-[#fff3d6] to-[#fde7b8] text-[#8a5a00]',
  },
  {
    key: 'documents',
    titleKey: 'home.shortcuts.documents.title',
    descriptionKey: 'home.shortcuts.documents.description',
    href: '/documents',
    icon: Files,
    eyebrowKey: 'home.shortcuts.documents.eyebrow',
    accentClassName: 'from-[#e9f5ff] via-[#d9ecff] to-[#c5e2ff] text-[#0b4f8a]',
  },
];

const adminShortcut: THomeShortcut = {
  key: 'admin',
  titleKey: 'home.shortcuts.admin.title',
  descriptionKey: 'home.shortcuts.admin.description',
  href: '/admin',
  icon: ShieldCheck,
  eyebrowKey: 'home.shortcuts.admin.eyebrow',
  accentClassName: 'from-[#eefce8] via-[#def6d1] to-[#ccecab] text-[#2f6b18]',
};

export const HomeSection: React.FC<IHomeSectionProps> = () => {
  const { t } = useTranslation();
  const profile = profileStore((state) => state.profile);
  const canOpenTemplates = canAccessTemplates(profile);
  const canOpenDocuments = canAccessDocuments(profile);
  const canOpenAdmin = canManageUsers(profile);
  const shortcuts = [
    ...(canOpenTemplates ? baseShortcuts.filter((shortcut) => shortcut.key === 'templates') : []),
    ...(canOpenDocuments ? baseShortcuts.filter((shortcut) => shortcut.key === 'documents') : []),
    ...(canOpenAdmin ? [adminShortcut] : []),
  ];
  const shortcutGridClassName =
    shortcuts.length >= 3
      ? 'max-w-6xl sm:grid-cols-2 xl:grid-cols-3'
      : shortcuts.length === 2
        ? 'max-w-4xl sm:grid-cols-2'
        : 'max-w-sm';

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ||
    profile?.username ||
    t('home.fallbackUser');

  return (
    <section className="relative min-h-full overflow-x-hidden bg-[#00284b] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(140deg,#00284b_0%,#083a67_45%,#0c4d85_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(242,198,102,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(118,190,255,0.16),transparent_34%)]" />
      <div className="absolute -right-24 top-24 h-72 w-72 rounded-full bg-[#f2c666]/16 blur-3xl" />
      <div className="absolute bottom-0 left-[-5rem] h-64 w-64 rounded-full bg-[#7bc4ff]/14 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-7xl flex-col px-6 py-7 md:px-10 md:py-8 lg:px-14">
        <div className="w-full">
          <div className="mt-6 flex justify-center md:mt-8">
            <img
              src="/gdu/logo/logo-icon.png"
              alt="Gia Dinh University"
              loading="lazy"
              decoding="async"
              width={220}
              height={100}
              className="h-auto w-28 object-contain sm:w-36"
            />
          </div>
          <div className="mt-4 flex justify-center">
            <div className="max-w-xl text-center">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#f4d99a]">{t('home.welcome')}</p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight text-white sm:text-4xl">{displayName}</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-white/82">{t('home.intro')}</p>
            </div>
          </div>
        </div>

        <div className={`mx-auto mt-8 grid w-full gap-4 pb-2 ${shortcutGridClassName}`}>
          {shortcuts.map((shortcut) => {
            const Icon = shortcut.icon;

            return (
              <Link
                key={shortcut.key}
                to={shortcut.href}
                className="group flex min-h-[220px] flex-col justify-between rounded-3xl border border-white/16 bg-white/12 p-5 text-white shadow-[0_18px_60px_rgba(3,10,25,0.28)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:bg-white/18">
                <div>
                  <div
                    className={`inline-flex rounded-2xl bg-gradient-to-br p-3 shadow-sm ring-1 ring-black/5 ${shortcut.accentClassName}`}>
                    <Icon className="size-6" />
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-white/65">
                    {t(shortcut.eyebrowKey)}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">{t(shortcut.titleKey)}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/78">{t(shortcut.descriptionKey)}</p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-white/12 pt-4 text-sm font-medium text-white/90">
                  <span>{t('home.openWorkspace')}</span>
                  <span className="inline-flex items-center gap-2 text-[#f8deb1] transition-transform duration-300 group-hover:translate-x-1">
                    {t('common.actions.open')}
                    <ArrowRight className="size-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};
