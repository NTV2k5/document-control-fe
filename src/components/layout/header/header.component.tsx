import { Link, useNavigate } from '@tanstack/react-router';
import { Bell, Filter, Mic, Search } from 'lucide-react';
import { useRef, useState } from 'react';
import { LanguageSwitcher } from '../../i18n';
import { useTranslation } from '../../../i18n';

export const Header = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationCount] = useState(3); // TODO: replace with real notification count from API
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate({ to: '/documents', search: { search: q } as never });
  };

  const handleMicClick = () => {
    // TODO: implement voice search
    inputRef.current?.focus();
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-4 shadow-sm">
      {/* Logo */}
      <Link to="/home" className="flex shrink-0 items-center gap-2">
        <img
          src="/gdu/logo/logo-icon.png"
          alt="Gia Dinh University"
          className="h-8 w-8 object-contain"
        />
        <img
          src="/gdu/logo/horizontal-long-logo-text.png"
          alt="Document Control"
          className="hidden h-7 w-auto object-contain sm:block"
        />
      </Link>

      {/* Search bar */}
      <form
        onSubmit={handleSearch}
        className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition-colors focus-within:border-[#0B2559]/40 focus-within:bg-white focus-within:shadow-sm">
        <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('header.searchPlaceholder')}
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
        {/* Filter icon */}
        <button
          type="button"
          title={t('header.filter')}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700">
          <Filter className="size-3.5" />
          <span className="hidden sm:inline">{t('header.filter')}</span>
        </button>

        {/* Mic icon */}
        <button
          type="button"
          title={t('header.voiceSearch')}
          onClick={handleMicClick}
          className="flex shrink-0 items-center justify-center rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600">
          <Mic className="size-4" />
        </button>

        {/* Search button */}
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-[#0B2559] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0d2d6b]">
          {t('header.search')}
        </button>
      </form>

      {/* Right side actions */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Language switcher (compact – VN/EN) */}
        <LanguageSwitcher compact className="border-slate-200 shadow-none" />

        {/* Notification bell */}
        <button
          type="button"
          title={t('header.notifications')}
          className="relative flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
          <Bell className="size-5" />
          {notificationCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
