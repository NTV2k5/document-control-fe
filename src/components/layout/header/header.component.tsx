import { useNavigate } from '@tanstack/react-router';
import { Mic, MicOff, Search, Menu, FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from '../../../i18n/use-translation';
import { searchFilesAPI, type ISearchFileResult } from 'api';
import { FilePreviewModal } from '../../hubs';
import { NotificationDropdown, type INotificationItem } from '../notification-dropdown';
import type { IHeaderProps, ISpeechRecognitionInstance } from './header.type';

const TRENDING_TAGS = [
  '#AIEthics',
  '#QuantumComputing',
  '#ModernArchitecture',
  '#Sustainability',
  '#Neuroscience',
  '#DigitalHumanities',
];

export const Header = ({ isSidebarCollapsed, onSidebarCollapsedChange }: IHeaderProps) => {
  const { t, locale, toggleLocale } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const activeLang = locale === 'vi' ? 'VI' : 'EN';
  const inputRef = useRef<HTMLInputElement>(null);

  // Suggestions search states
  const [suggestions, setSuggestions] = useState<ISearchFileResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [previewFile, setPreviewFile] = useState<{
    entityName: string;
    fileName: string;
    mimeType?: string | null;
    fileUrl?: string | null;
  } | null>(null);

  // Speech Recognition states
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<ISpeechRecognitionInstance | null>(null);

  // Debounced search for suggestions
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }

    const handler = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await searchFilesAPI(q);
        setSuggestions(results);
      } catch (err) {
        console.error('Failed to search files', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setShowSuggestions(false);
    void navigate({ to: '/documents', search: { search: q } as never });
  };

  // Speech recognition handler
  const handleMicClick = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.warning(
        locale === 'vi'
          ? 'Trình duyệt của bạn không hỗ trợ tìm kiếm bằng giọng nói.'
          : 'Voice search is not supported in your browser.',
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = locale === 'vi' ? 'vi-VN' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        inputRef.current?.focus();
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setSearchQuery(transcript);
        setShowSuggestions(true);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast.error(
            locale === 'vi'
              ? 'Quyền truy cập micro đã bị từ chối. Vui lòng cho phép quyền micro.'
              : 'Microphone access denied. Please allow microphone permission.',
          );
        } else if (event.error !== 'no-speech') {
          toast.error(
            locale === 'vi'
              ? 'Có lỗi xảy ra khi nhận diện giọng nói.'
              : 'An error occurred during speech recognition.',
          );
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Failed to initialize speech recognition:', err);
      setIsListening(false);
      toast.error(
        locale === 'vi'
          ? 'Không thể khởi chạy tìm kiếm giọng nói.'
          : 'Could not launch voice search.',
      );
    }
  };

  const handleSelectNotification = (item: INotificationItem) => {
    const fileUrl = item.file_url
      ? item.file_url
      : `/api/method/drive.api.s3.fetch?path=${encodeURIComponent(item.user_name || item.shared_by_email)}/${encodeURIComponent(item.file_name)}`;

    setPreviewFile({
      entityName: item.id,
      fileName: item.file_name,
      mimeType: item.file_type === 'Video' ? 'video/mp4' : null,
      fileUrl,
    });
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#F4F7FE] shadow-[0_1px_0_rgba(0,0,0,0.06)]">
      {/* Top row: Search + Actions */}
      <div className="flex h-16 items-center justify-between gap-4 px-6">
        {onSidebarCollapsedChange && (
          <button
            type="button"
            onClick={() => onSidebarCollapsedChange(!isSidebarCollapsed)}
            className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden shrink-0 border border-slate-200 bg-white"
          >
            <Menu className="size-5" />
          </button>
        )}
        {/* Search bar pill */}
        <form
          onSubmit={handleSearch}
          className={`relative flex h-11 flex-1 items-center gap-2 rounded-full border bg-white pl-4 pr-1.5 transition-all ${
            isListening
              ? 'border-red-400 ring-2 ring-red-100 shadow-md'
              : 'border-slate-200 focus-within:border-blue-400 focus-within:shadow-sm'
          }`}
        >
          <Search className="size-4 text-slate-400 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={
              isListening
                ? locale === 'vi'
                  ? 'Đang nghe... Nói từ khóa tìm kiếm của bạn'
                  : 'Listening... Speak your search query'
                : t('header.searchPlaceholder')
            }
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />

          {/* Right side of pill: Mic, Search Btn */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              type="button"
              title={
                isListening
                  ? locale === 'vi'
                    ? 'Dừng nghe'
                    : 'Stop listening'
                  : t('header.voiceSearch')
              }
              onClick={handleMicClick}
              className={`flex items-center justify-center rounded-full p-1.5 transition-all ${
                isListening
                  ? 'bg-red-50 text-red-600 animate-pulse ring-2 ring-red-400'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
            >
              {isListening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
            </button>
            <button
              type="submit"
              className="rounded-full bg-blue-600 px-5 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              {t('header.search')}
            </button>
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-12 z-50 mt-1 max-h-[300px] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-3 shadow-xl">
              {isSearching ? (
                <div className="py-4 text-center text-xs font-semibold text-slate-400">
                  {locale === 'vi' ? 'Đang tìm kiếm...' : 'Searching...'}
                </div>
              ) : suggestions.length === 0 ? (
                <div className="py-4 text-center text-xs font-semibold text-slate-400">
                  {locale === 'vi' ? 'Không tìm thấy kết quả nào' : 'No results found'}
                </div>
              ) : (
                <div className="space-y-1">
                  {suggestions.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        setPreviewFile({
                          entityName: item.name,
                          fileName: item.file_name,
                          mimeType: item.file_type === 'Video' ? 'video/mp4' : null,
                          fileUrl: `/api/method/drive.api.s3.fetch?path=${encodeURIComponent(item.user_name)}/${encodeURIComponent(item.file_name)}`,
                        });
                        setShowSuggestions(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-700">{item.file_name}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400 truncate">
                          {locale === 'vi' ? 'Bởi ' : 'By '}{item.full_name || item.user_name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>

        {/* Right side actions */}
        <div className="flex shrink-0 items-center gap-3">
          {/* Language switcher pill */}
          <button
            type="button"
            onClick={toggleLocale}
            className="hidden h-8 w-[68px] cursor-pointer items-center rounded-full bg-slate-100 p-1 transition-colors hover:bg-slate-200 sm:flex"
            title="Switch language"
          >
            <div
              className={`flex h-full w-1/2 items-center justify-center rounded-full transition-all ${activeLang === 'VI' ? 'bg-white shadow-sm' : ''}`}
            >
              <span className={`text-[11px] font-bold ${activeLang === 'VI' ? 'text-slate-900' : 'text-slate-500'}`}>VN</span>
            </div>
            <div
              className={`flex h-full w-1/2 items-center justify-center rounded-full transition-all ${activeLang === 'EN' ? 'bg-white shadow-sm' : ''}`}
            >
              <span className={`text-[11px] font-bold ${activeLang === 'EN' ? 'text-slate-900' : 'text-slate-500'}`}>EN</span>
            </div>
          </button>

          {/* Notification dropdown component */}
          <NotificationDropdown onSelectNotification={handleSelectNotification} />
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

      {previewFile && (
        <FilePreviewModal
          open={previewFile !== null}
          onClose={() => setPreviewFile(null)}
          entityName={previewFile.entityName}
          fileName={previewFile.fileName}
          mimeType={previewFile.mimeType}
          fileUrl={previewFile.fileUrl}
        />
      )}
    </header>
  );
};
