import type { IRouteConfig, ISidebarProps } from '../layout.type';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  BarChart3,
  Bot,
  Braces,
  ClipboardPenLine,
  FileText,
  Files,
  FolderGit2,
  FolderOpen,
  FolderOutput,
  Globe,

  Folders,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Network,
  Landmark,
  Settings,
  Share2,
  Shield,
  Ticket,
  Trash2,
  Users,
} from 'lucide-react';
import {
  DOCUMENT_INPUT_AGENT_SETTINGS_UPDATED_EVENT,
  getDocumentInputAgentSettingsAPI,
  type IDocumentInputAgentSettings,
} from 'api';
import { SidebarItem } from '../sidebar-item';
import {
  TECH_CONFIG_VARIABLE_ENABLED,
  canAccessDashboard,
  canAccessDocuments,
  canAccessTechRoot,
  canAccessTemplates,
  canManageUsers,
  isRootProfile,
  profileStore,
  useAuth,
} from 'reactjs-platform/utilities';
import { useTranslation } from '../../../i18n/use-translation';

type TAgentSidebarSettings = Pick<
  IDocumentInputAgentSettings,
  'document_input_agent_enabled' | 'template_agent_enabled' | 'use_global_llm_config'
>;

const AGENT_SIDEBAR_SETTINGS_CACHE_KEY = 'agent-sidebar-settings-v1';
const DEFAULT_AGENT_SIDEBAR_SETTINGS: TAgentSidebarSettings = {
  document_input_agent_enabled: true,
  template_agent_enabled: true,
  use_global_llm_config: true,
};

const readAgentSidebarSettingsCache = (): TAgentSidebarSettings | null => {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.sessionStorage.getItem(AGENT_SIDEBAR_SETTINGS_CACHE_KEY);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue) as Partial<TAgentSidebarSettings>;

    if (
      typeof parsed.document_input_agent_enabled !== 'boolean' ||
      typeof parsed.template_agent_enabled !== 'boolean' ||
      typeof parsed.use_global_llm_config !== 'boolean'
    ) {
      return null;
    }

    return {
      document_input_agent_enabled: parsed.document_input_agent_enabled,
      template_agent_enabled: parsed.template_agent_enabled,
      use_global_llm_config: parsed.use_global_llm_config,
    };
  } catch {
    return null;
  }
};

const writeAgentSidebarSettingsCache = (settings: TAgentSidebarSettings) => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(AGENT_SIDEBAR_SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch {
    // Cache này chỉ để tránh sidebar giật khi reload, lỗi ghi cache không ảnh hưởng quyền thật.
  }
};

const pickAgentSidebarSettings = (settings: TAgentSidebarSettings): TAgentSidebarSettings => ({
  document_input_agent_enabled: settings.document_input_agent_enabled,
  template_agent_enabled: settings.template_agent_enabled,
  use_global_llm_config: settings.use_global_llm_config,
});

// Mock storage data – replace with real API when available
const STORAGE_USED_GB = 4.2;
const STORAGE_TOTAL_GB = 10;
const STORAGE_PERCENT = Math.round((STORAGE_USED_GB / STORAGE_TOTAL_GB) * 100);

export const Sidebar = ({ routes, isCollapsed, onCollapsedChange }: ISidebarProps) => {
  const { t, locale, toggleLocale } = useTranslation();

  const { logout } = useAuth();
  const navigate = useNavigate();
  const profile = profileStore((state) => state.profile);

  const displayName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email
    : null;

  const isAdmin = profile ? isRootProfile(profile) : false;
  const canReadAgentSettings = profile ? isRootProfile(profile) : false;

  const roleLabel = profile
    ? isAdmin
      ? t('navigation.admin')
      : t('navigation.viewer')
    : null;

  const [agentSidebarSettings, setAgentSidebarSettings] = useState<TAgentSidebarSettings | null>(
    readAgentSidebarSettingsCache,
  );

  useEffect(() => {
    if (!canReadAgentSettings) return;

    let cancelled = false;

    getDocumentInputAgentSettingsAPI()
      .then((settings) => {
        if (cancelled) return;
        const picked = pickAgentSidebarSettings(settings);
        setAgentSidebarSettings(picked);
        writeAgentSidebarSettingsCache(picked);
      })
      .catch(() => {
        // Silently ignore – sidebar will use defaults
      });

    return () => {
      cancelled = true;
    };
  }, [canReadAgentSettings]);

  useEffect(() => {
    const handleSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<Partial<IDocumentInputAgentSettings>>).detail;
      if (
        typeof detail?.document_input_agent_enabled === 'boolean' ||
        typeof detail?.template_agent_enabled === 'boolean' ||
        typeof detail?.use_global_llm_config === 'boolean'
      ) {
        setAgentSidebarSettings((current) => {
          const nextSettings = {
            document_input_agent_enabled:
              typeof detail.document_input_agent_enabled === 'boolean'
                ? detail.document_input_agent_enabled
                : (current?.document_input_agent_enabled ??
                  DEFAULT_AGENT_SIDEBAR_SETTINGS.document_input_agent_enabled),
            template_agent_enabled:
              typeof detail.template_agent_enabled === 'boolean'
                ? detail.template_agent_enabled
                : (current?.template_agent_enabled ?? DEFAULT_AGENT_SIDEBAR_SETTINGS.template_agent_enabled),
            use_global_llm_config:
              typeof detail.use_global_llm_config === 'boolean'
                ? detail.use_global_llm_config
                : (current?.use_global_llm_config ?? DEFAULT_AGENT_SIDEBAR_SETTINGS.use_global_llm_config),
          };

          writeAgentSidebarSettingsCache(nextSettings);
          return nextSettings;
        });
      }
    };

    window.addEventListener(DOCUMENT_INPUT_AGENT_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    return () => {
      window.removeEventListener(DOCUMENT_INPUT_AGENT_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    };
  }, []);

  const templateRoutes: IRouteConfig[] = [
    {
      key: 'templates',
      label: t('navigation.templates'),
      href: '/templates',
      icon: <FileText className="size-5" />,
      match: (path) => path === '/templates' || (path.startsWith('/templates/') && !path.startsWith('/templates/new')),
    },
  ];

  const documentInputAgentRoute: IRouteConfig = {
    key: 'document-input-agent',
    label: t('navigation.documentInputAgent'),
    href: '/document-input-agent',
    icon: <Bot className="size-5" />,
    match: (path) => path.startsWith('/document-input-agent'),
  };

  const templateAgentRoute: IRouteConfig = {
    key: 'template-agent',
    label: t('navigation.templateAgent'),
    href: '/template-agent',
    icon: <ClipboardPenLine className="size-5" />,
    match: (path) => path.startsWith('/template-agent'),
  };

  const documentInputAgentHistoryRoute: IRouteConfig = {
    key: 'document-input-agent-history',
    label: t('navigation.documentInputAgentHistory'),
    href: '/document-input-agent-history',
    icon: <History className="size-5" />,
    match: (path) => path.startsWith('/document-input-agent-history'),
  };

  const adminRoute: IRouteConfig = {
    key: 'admin',
    label: t('navigation.adminPanel'),
    href: '/admin',
    icon: <Shield className="size-5" />,
    match: (path) => path.startsWith('/admin'),
  };

  const openaiRoute: IRouteConfig = {
    key: 'openai',
    label: t('navigation.openaiSettings'),
    href: '/openai',
    icon: <Braces className="size-5" />,
    match: (path) => path.startsWith('/openai'),
  };

  const sharingRoute: IRouteConfig = {
    key: 'sharing',
    label: 'Sharing',
    href: '/dashboard/sharing',
    icon: <Share2 className="size-5" />,
    match: (path) => path.startsWith('/dashboard/sharing'),
  };

  const sharedRoute: IRouteConfig = {
    key: 'shared',
    label: 'Shared',
    href: '/dashboard/shared',
    icon: <Users className="size-5" />,
    match: (path) => path.startsWith('/dashboard/shared'),
  };

  const recycleBinRoute: IRouteConfig = {
    key: 'recycle-bin',
    label: 'Recycle Bin',
    href: '/dashboard/recycle-bin',
    icon: <Trash2 className="size-5" />,
    match: (path) => path.startsWith('/dashboard/recycle-bin'),
  };

  const ticketsRoute: IRouteConfig = {
    key: 'tickets',
    label: 'Tickets',
    href: '/dashboard/tickets',
    icon: <Ticket className="size-5" />,
    match: (path) => path.startsWith('/dashboard/tickets'),
  };

  const agentSettingsRoutes: IRouteConfig[] = TECH_CONFIG_VARIABLE_ENABLED
    ? [
        {
          key: 'template-variable-docs',
          label: t('navigation.templateVariableDocs'),
          href: '/template-variable-docs',
          icon: <BarChart3 className="size-5" />,
          match: (path) => path.startsWith('/template-variable-docs'),
        },
        openaiRoute,
      ]
    : [];

  const documentInputAgentHistoryRoutes: IRouteConfig[] = isAdmin
    ? [documentInputAgentHistoryRoute]
    : [];

  // ─── Primary nav matching the Figma design ───────────────────────────────────
  const primaryRoutes: IRouteConfig[] = [
    {
      key: 'home',
      label: 'Overview',
      href: '/home',
      icon: <LayoutDashboard className="size-5" />,
      match: (path) => path === '/home' || path === '/',
    },
    {
      key: 'documents',
      label: 'Published Documents',
      href: '/documents',
      icon: <FileText className="size-5" />,
      match: (path) => path.startsWith('/documents'),
    },
    {
      key: 'university-hubs',
      label: 'University Hubs',
      href: '/dashboard/hubs',
      icon: <Network className="size-5" />,
      match: (path) => path.startsWith('/dashboard/hubs'),
    },
    {
      key: 'my-hubs',
      label: 'My Hubs',
      href: '/dashboard/my-hubs',
      icon: <FolderGit2 className="size-5" />,
      match: (path) => path.startsWith('/dashboard/my-hubs'),
    },
    ticketsRoute,
  ];

  const managementRoutes: IRouteConfig[] = [
    sharingRoute,
    sharedRoute,
    recycleBinRoute,
    ...(isAdmin ? [...documentInputAgentHistoryRoutes, adminRoute, ...agentSettingsRoutes] : []),
    {
      key: 'settings',
      label: 'Settings',
      href: '/settings',
      icon: <Settings className="size-5" />,
      match: (path) => path.startsWith('/settings'),
    },
  ];

  const shouldWaitForProfile = !routes && !profile;
  const routeList = shouldWaitForProfile ? [] : (routes ?? primaryRoutes);
  const { pathname } = useLocation();

  return (
    <aside
      className={`fixed bottom-0 left-0 top-0 z-50 flex flex-col border-r border-slate-200 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.03)] transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-0 overflow-hidden sm:w-[72px]' : 'w-64'
      }`}>
      {/* Logo Area */}
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            {/* Landmark icon */}
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-800 text-white shadow-[0_4px_12px_rgba(30,64,175,0.4)]">
              <Landmark className="size-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[14px] font-bold text-slate-800 whitespace-nowrap">Document Control</span>
              <span className="text-[9px] font-bold tracking-widest text-blue-800 uppercase">ADMIN</span>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-blue-800 text-white shadow-[0_4px_12px_rgba(30,64,175,0.4)]">
            <Landmark className="size-5" />
          </div>
        )}
        {!isCollapsed && (
          <button
            onClick={() => onCollapsedChange(!isCollapsed)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Collapse sidebar"
          >
            <ArrowLeftToLine className="size-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <button
          onClick={() => onCollapsedChange(!isCollapsed)}
          className="mx-auto mt-3 flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="Expand sidebar"
        >
          <ArrowRightToLine className="size-4" />
        </button>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-1">
        {/* Main Routes */}
        <nav className="flex flex-col gap-0.5">
          {routeList.map((route) => (
            <SidebarItem
              key={route.key}
              icon={route.icon}
              label={route.label}
              href={route.href}
              is_active={route.match(pathname)}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>

        {/* Management Routes */}
        {(!shouldWaitForProfile && managementRoutes.length > 0) && (
          <div className="pt-4">
            {!isCollapsed && (
              <div className="mb-2 px-3 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                MANAGEMENT
              </div>
            )}
            <nav className="flex flex-col gap-0.5">
              {managementRoutes.map((route) => (
                <SidebarItem
                  key={route.key}
                  icon={route.icon}
                  label={route.label}
                  href={route.href}
                  is_active={route.match(pathname)}
                  isCollapsed={isCollapsed}
                />
              ))}

              {/* Mobile-only Language Switcher (Pill Style) */}
              <div className="flex items-center justify-between px-5 py-2.5 sm:hidden">
                <div className="flex items-center gap-3 text-slate-500">
                  <Globe className="size-5 shrink-0" />
                  <span className="font-bold text-[12.5px]">
                    Language
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleLocale}
                  className="h-8 w-[68px] shrink-0 cursor-pointer items-center rounded-full bg-slate-100 p-1 transition-colors hover:bg-slate-200 flex"
                  title="Switch language"
                >
                  <div
                    className={`flex h-full w-1/2 items-center justify-center rounded-full transition-all ${locale === 'vi' ? 'bg-white shadow-sm' : ''}`}
                  >
                    <span className={`text-[11px] font-bold ${locale === 'vi' ? 'text-slate-900' : 'text-slate-500'}`}>VN</span>
                  </div>
                  <div
                    className={`flex h-full w-1/2 items-center justify-center rounded-full transition-all ${locale === 'en' ? 'bg-white shadow-sm' : ''}`}
                  >
                    <span className={`text-[11px] font-bold ${locale === 'en' ? 'text-slate-900' : 'text-slate-500'}`}>EN</span>
                  </div>
                </button>
              </div>
            </nav>


          </div>
        )}
      </div>

      {/* User Profile & Storage Area */}
      <div className="border-t border-slate-100 p-3">
        {!isCollapsed ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-3">
            <div
              onClick={() => navigate({ to: '/profile' })}
              className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80"
            >
              <img
                src="https://i.pravatar.cc/150?u=a042581f4e29026024d"
                alt="Avatar"
                className="size-9 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm"
              />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold text-slate-900">{displayName || 'Dr. Sarah Jenkins'}</span>
                <span className="truncate text-xs text-slate-500">{roleLabel || 'Dean of Information'}</span>
              </div>
            </div>

            <div className="rounded-xl bg-[#2E2063] p-3 text-white">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
                Storage Usage
              </div>
              <div className="text-sm font-bold">
                {STORAGE_USED_GB} TB / {STORAGE_TOTAL_GB} TB
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full bg-blue-400 transition-all"
                  style={{ width: `${STORAGE_PERCENT}%` }}
                />
              </div>
            </div>

            <button
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white py-2 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50 hover:border-red-300"
            >
              <LogOut className="size-4" />
              Sign Out
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <img
              onClick={() => navigate({ to: '/profile' })}
              src="https://i.pravatar.cc/150?u=a042581f4e29026024d"
              alt="Avatar"
              className="size-9 cursor-pointer rounded-full object-cover ring-2 ring-white shadow-sm transition-opacity hover:opacity-80"
            />
            <button
              onClick={logout}
              className="rounded-xl bg-red-50 p-2 text-red-500 hover:bg-red-100 transition-colors"
              title="Sign Out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
