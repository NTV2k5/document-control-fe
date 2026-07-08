import { useNavigate } from '@tanstack/react-router';
import { Bell, Filter, Mic, Search } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from '../../../i18n';

const TRENDING_TAGS = [
  '#AIEthics',
  '#QuantumComputing',
  '#ModernArchitecture',
  '#Sustainability',
  '#Neuroscience',
  '#DigitalHumanities',
];

export const Header = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationCount] = useState(3); // TODO: replace with real notification count from API
  const [activeLang, setActiveLang] = useState<'VN' | 'EN'>('VN');
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
    <header className="sticky top-0 z-40 w-full bg-[#F4F7FE] shadow-[0_1px_0_rgba(0,0,0,0.06)]">
      {/* Top row: Search + Actions */}
      <div className="flex h-16 items-center justify-between gap-4 px-6">
        {/* Search bar pill */}
        <form
          onSubmit={handleSearch}
          className="flex h-11 flex-1 max-w-2xl items-center gap-2 rounded-full border border-slate-200 bg-white pl-4 pr-1.5 transition-colors focus-within:border-blue-400 focus-within:shadow-sm">
          <Search className="size-4 text-slate-400 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('header.searchPlaceholder')}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />

          {/* Right side of pill: Filter, Mic, Search Btn */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              type="button"
              title={t('header.filter')}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700">
              <Filter className="size-3.5" />
              <span className="hidden sm:inline">Filter</span>
            </button>
            <button
              type="button"
              title={t('header.voiceSearch')}
              onClick={handleMicClick}
              className="flex items-center justify-center rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
              <Mic className="size-3.5" />
            </button>
            <button
              type="submit"
              className="rounded-full bg-blue-600 px-5 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700">
              Search
            </button>
          </div>
        </form>

        {/* Right side actions */}
        <div className="flex shrink-0 items-center gap-3">
          {/* Language switcher pill */}
          <button
            type="button"
            onClick={() => setActiveLang((l) => (l === 'VN' ? 'EN' : 'VN'))}
            className="hidden h-8 w-[68px] cursor-pointer items-center rounded-full bg-slate-100 p-1 transition-colors hover:bg-slate-200 sm:flex"
            title="Switch language"
          >
            <div
              className={`flex h-full w-1/2 items-center justify-center rounded-full transition-all ${activeLang === 'VN' ? 'bg-white shadow-sm' : ''}`}
            >
              <span className={`text-[11px] font-bold ${activeLang === 'VN' ? 'text-slate-900' : 'text-slate-500'}`}>VN</span>
            </div>
            <div
              className={`flex h-full w-1/2 items-center justify-center rounded-full transition-all ${activeLang === 'EN' ? 'bg-white shadow-sm' : ''}`}
            >
              <span className={`text-[11px] font-bold ${activeLang === 'EN' ? 'text-slate-900' : 'text-slate-500'}`}>EN</span>
            </div>
          </button>

          {/* Notification bell */}
          <button
            type="button"
            title={t('header.notifications')}
            className="relative flex size-9 items-center justify-center rounded-full bg-white text-slate-600 border border-slate-200 transition-colors hover:bg-slate-50">
            <Bell className="size-4" />
            {notificationCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex size-2 items-center justify-center rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>
        </div>
      </div>

      {/* Trending hashtags row — fixed beneath search bar */}
      <div className="flex items-center gap-3 border-t border-slate-100 bg-[#F4F7FE] px-6 py-2">
        <span className="shrink-0 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
          TRENDING
        </span>
        <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto">
          {TRENDING_TAGS.map((tag, i) => (
            <button
              key={tag}
              type="button"
              className={`shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold shadow-sm transition-all hover:shadow-md hover:border-blue-200 ${
                i % 2 !== 0 ? 'text-blue-600' : 'text-slate-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
