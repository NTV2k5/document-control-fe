import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Share2, CheckCheck, ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { listSharedFilesAPI, mapFileType } from 'api';
import { useTranslation } from '../../../i18n/use-translation';
import type { INotificationDropdownProps, INotificationItem } from './notification-dropdown.type';

const STORAGE_READ_KEY = 'read_shared_notification_ids';

const getStoredReadIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(STORAGE_READ_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
};

const saveStoredReadIds = (ids: Set<string>) => {
  try {
    localStorage.setItem(STORAGE_READ_KEY, JSON.stringify(Array.from(ids)));
  } catch (err) {
    console.error('Failed to save read notification IDs', err);
  }
};

const formatRelativeTime = (isoString: string, locale: string): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (locale === 'vi') {
      if (diffSec < 60) return 'Vừa xong';
      if (diffMin < 60) return `${diffMin} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays < 7) return `${diffDays} ngày trước`;
      return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  } catch {
    return isoString;
  }
};

export const NotificationDropdown = ({ onSelectNotification }: INotificationDropdownProps) => {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<INotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => getStoredReadIds());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchSharedNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listSharedFilesAPI();
      const storedRead = getStoredReadIds();

      const mapped: INotificationItem[] = data.map((item: any) => {
        const id = item.name || String(Math.random());
        const isReadByBackend = item.read === 1 || Boolean(item.accessed);
        const isReadLocally = storedRead.has(id);
        const isRead = isReadByBackend || isReadLocally;

        return {
          id,
          file_name: item.file_name || 'Untitled',
          shared_by_name: item.owner_full_name || item.owner || 'Administrator',
          shared_by_email: item.owner || '',
          shared_at: item.modified || item.creation || new Date().toISOString(),
          read: isRead,
          file_size: item.file_size || 0,
          file_type: mapFileType(item.file_type || '', item.file_name),
          file_url: item.file_url || null,
          user_name: item.owner || '',
          raw_item: item,
        };
      });

      setNotifications(mapped);
    } catch (err) {
      console.error('Failed to fetch shared notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and set up polling every 30s
  useEffect(() => {
    void fetchSharedNotifications();
    const interval = setInterval(() => {
      void fetchSharedNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchSharedNotifications]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    const newReadIds = new Set(readIds);
    notifications.forEach((n) => newReadIds.add(n.id));
    setReadIds(newReadIds);
    saveStoredReadIds(newReadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationClick = (item: INotificationItem) => {
    // Mark single notification as read
    if (!item.read) {
      const newReadIds = new Set(readIds);
      newReadIds.add(item.id);
      setReadIds(newReadIds);
      saveStoredReadIds(newReadIds);
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    }
    setIsOpen(false);

    if (onSelectNotification) {
      onSelectNotification(item);
    } else {
      void navigate({ to: '/dashboard/shared' as never });
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        title={t('header.notifications')}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            void fetchSharedNotifications();
          }
        }}
        className="relative flex size-9 items-center justify-center rounded-full bg-white text-slate-600 border border-slate-200 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">
                {locale === 'vi' ? 'Thông báo chia sẻ' : 'Shared Notifications'}
              </h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-600">
                  {unreadCount} {locale === 'vi' ? 'mới' : 'new'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void fetchSharedNotifications()}
                title={locale === 'vi' ? 'Làm mới' : 'Refresh'}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <CheckCheck className="size-3.5" />
                  <span>{locale === 'vi' ? 'Đã đọc tất cả' : 'Mark all read'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[360px] overflow-y-auto p-1.5 space-y-0.5 divide-y divide-slate-50">
            {loading && notifications.length === 0 ? (
              <div className="py-8 text-center text-xs font-semibold text-slate-400">
                {locale === 'vi' ? 'Đang tải thông báo...' : 'Loading notifications...'}
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-2">
                  <Bell className="size-5" />
                </div>
                <p className="text-xs font-medium text-slate-500">
                  {locale === 'vi' ? 'Không có thông báo tệp chia sẻ nào' : 'No shared notifications'}
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNotificationClick(item)}
                  className={`group relative flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors ${
                    !item.read ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100/70 text-blue-600 group-hover:scale-105 transition-transform">
                    <Share2 className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug text-slate-800">
                      <span className="font-bold text-slate-900">{item.shared_by_name}</span>{' '}
                      {locale === 'vi' ? 'đã chia sẻ tệp:' : 'shared a file with you:'}
                    </p>
                    <p className="mt-1 truncate text-xs font-semibold text-blue-600 flex items-center gap-1.5">
                      <FileText className="size-3 shrink-0" />
                      <span className="truncate">{item.file_name}</span>
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-slate-400">
                      {formatRelativeTime(item.shared_at, locale)}
                    </p>
                  </div>
                  {!item.read && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-600 ring-2 ring-blue-100" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 p-2 bg-slate-50/50 rounded-b-2xl">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                void navigate({ to: '/dashboard/shared' as never });
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <span>{locale === 'vi' ? 'Xem tất cả tệp được chia sẻ' : 'View all shared files'}</span>
              <ExternalLink className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
