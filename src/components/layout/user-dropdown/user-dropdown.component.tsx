import {
  useAuth,
  useProfile,
  canAccessDashboard,
  canAccessDocuments,
  canAccessTemplates,
  canManageUsers,
} from 'reactjs-platform/utilities';
import { cn } from '../../../lib';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { BarChart3, FileText, Files, LogOut, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LanguageSwitcher } from '../../i18n';
import { useTranslation } from '../../../i18n';

export const UserDropdown = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const { logout } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const hasDashboardAccess = canAccessDashboard(profile);
  const hasTemplateAccess = canAccessTemplates(profile);
  const hasDocumentAccess = canAccessDocuments(profile);
  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || profile?.username || '';
  const primaryScopeAssignment =
    profile?.scope_assignments?.find((assignment) => assignment.is_primary) ?? profile?.scope_assignments?.[0];
  const roleLabel = primaryScopeAssignment?.role.role_name || primaryScopeAssignment?.role.role_key || '';
  const menuItems = [
    ...(hasDashboardAccess
      ? [
          {
            id: 'dashboard',
            label: t('navigation.dashboard'),
            href: '/dashboard',
            icon: <BarChart3 className="size-3.5" />,
          },
        ]
      : []),
    ...(hasTemplateAccess
      ? [
          {
            id: 'templates',
            label: t('navigation.templates'),
            href: '/templates',
            icon: <FileText className="size-3.5" />,
          },
        ]
      : []),
    ...(hasDocumentAccess
      ? [
          {
            id: 'documents',
            label: t('navigation.documents'),
            href: '/documents',
            icon: <Files className="size-3.5" />,
          },
        ]
      : []),
    ...(canManageUsers(profile)
      ? [{ id: 'admin', label: t('navigation.admin'), href: '/admin', icon: <Users className="size-3.5" /> }]
      : []),
  ];

  const isValidImage = (url: string) => /\.(?:jpeg|jpg|gif|png|webp)$/i.test(url);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition-all hover:bg-gray-100',
          isOpen ? 'border-gray-300 bg-gray-50' : 'border-transparent',
        )}
        onClick={() => setIsOpen(!isOpen)}>
        {/* Avatar with online dot */}
        <div className="relative shrink-0">
          {profile?.profile_url && isValidImage(profile.profile_url) ? (
            <img src={profile.profile_url} alt="" className="size-7 rounded-full object-cover" />
          ) : (
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=EBF4FF&color=7F9CF5`}
              alt=""
              className="size-7 rounded-full object-cover"
            />
          )}
          <span className="absolute bottom-0 right-0 size-2 rounded-full bg-green-500 ring-1 ring-white" />
        </div>

        {/* Name + role + email */}
        <div className="flex min-w-[132px] max-w-[190px] flex-col items-start text-left">
          <span className="w-full truncate text-xs font-semibold leading-tight text-gray-800">{displayName}</span>
          {roleLabel ? (
            <span className="w-full truncate text-[11px] leading-tight text-gray-600">{roleLabel}</span>
          ) : null}
          <span className="w-full truncate text-[11px] leading-tight text-gray-500">{profile?.email}</span>
        </div>

        {/* Chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          focusable="false"
          className={cn('ml-0.5 shrink-0 transition-transform', isOpen && 'rotate-180')}>
          <path
            d="M16.293 8.05029L12 12.3433L7.70697 8.05029L6.29297 9.46429L12 15.1713L17.707 9.46429L16.293 8.05029Z"
            fill="#374151"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-md">
          {/* Nav menu */}
          <div className="p-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate({ to: item.href as never });
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? 'bg-[#0B2559] text-white'
                    : 'text-gray-700 hover:bg-gray-100',
                )}>
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Language */}
          <div className="border-t border-gray-100 p-2">
            <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {t('language.label')}
            </div>
            <div className="px-1">
              <LanguageSwitcher className="shadow-none" />
            </div>
          </div>

          {/* Change password */}
          <div className="border-t border-gray-100 p-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate({ to: '/change-password' });
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
                <path
                  d="M14.1667 6.6665C14.8233 7.49984 15 8.33317 15 9.1665V9.99984M7.5 9.1665C7.5 7.8515 8.61917 6.6665 10 6.6665C11.3808 6.6665 12.5 7.8515 12.5 9.1665V10.8332M10 9.1665V10.8332"
                  stroke="currentColor"
                  strokeWidth="1.66667"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5 9.9998V8.83563C4.995 7.1698 5.94667 5.62813 7.49417 4.79397C8.2643 4.38303 9.12365 4.16772 9.99656 4.16699C10.8695 4.16627 11.7292 4.38015 12.5 4.7898M10 14.1665V17.4998M8.33333 16.6665L11.6667 14.9998M8.33333 14.9998L11.6667 16.6665M4.16667 14.1665V17.4998M2.5 16.6665L5.83333 14.9998M2.5 14.9998L5.83333 16.6665M15.8333 14.1665V17.4998M14.1667 16.6665L17.5 14.9998M14.1667 14.9998L17.5 16.6665"
                  stroke="currentColor"
                  strokeWidth="1.66667"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{t('navigation.changePassword')}</span>
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-gray-100 p-1">
            <button
              type="button"
              onClick={() => logout()}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
              <LogOut className="size-3.5" />
              <span>{t('navigation.logout')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
