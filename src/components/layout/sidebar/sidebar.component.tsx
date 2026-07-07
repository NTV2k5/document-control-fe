import type { IRouteConfig, ISidebarProps } from '../layout.type';
import { useLocation } from '@tanstack/react-router';
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
  History,
  Home,
  Settings,
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
} from 'reactjs-platform/utilities';
import { useTranslation } from '../../../i18n';

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

export const Sidebar = ({ routes, isCollapsed, onCollapsedChange }: ISidebarProps) => {
  const { t } = useTranslation();
  // Subscribe to profile store so sidebar re-renders when profile loads
  const profile = profileStore((s) => s.profile);
  const isAdmin = canManageUsers(profile);
  const hasDashboardAccess = canAccessDashboard(profile);
  const hasTemplateAccess = canAccessTemplates(profile);
  const hasDocumentAccess = canAccessDocuments(profile);
  const hasTechRootAccess = canAccessTechRoot(profile);
  const hasRootAccess = isRootProfile(profile);
  const canUseDocumentInputAgent = isAdmin || hasDocumentAccess || hasTemplateAccess;
  const canReadAgentSettings = hasTechRootAccess || canUseDocumentInputAgent;
  const [agentSidebarSettings, setAgentSidebarSettings] = useState<TAgentSidebarSettings | null>(
    readAgentSidebarSettingsCache,
  );
  const agentSettings: TAgentSidebarSettings =
    canReadAgentSettings && agentSidebarSettings ? agentSidebarSettings : DEFAULT_AGENT_SIDEBAR_SETTINGS;

  useEffect(() => {
    if (!canReadAgentSettings) {
      return;
    }

    let cancelled = false;
    getDocumentInputAgentSettingsAPI()
      .then((settings) => {
        if (!cancelled) {
          const nextSettings = pickAgentSidebarSettings(settings);
          setAgentSidebarSettings(nextSettings);
          writeAgentSidebarSettingsCache(nextSettings);
        }
      })
      .catch((error) => {
        console.warn('Không thể tải cấu hình agent cho sidebar.', error);
        if (!cancelled) {
          setAgentSidebarSettings((current) => current ?? DEFAULT_AGENT_SIDEBAR_SETTINGS);
        }
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
      icon: <FileText className="size-6" />,
      match: (path) => path === '/templates' || (path.startsWith('/templates/') && !path.startsWith('/templates/new')),
    },
  ];

  const techRootRoutes: IRouteConfig[] = [
    {
      key: 'template-variables',
      label: t('navigation.templateVariables'),
      href: '/template-variables',
      icon: <Braces className="size-6" />,
      match: (path) => path === '/template-variables' || path.startsWith('/template-variables/'),
    },
    // {
    //   key: 'template-variable-docs',
    //   label: t('navigation.templateVariableDocs'),
    //   href: '/template-variable-docs',
    //   icon: <BookOpen className="size-6" />,
    //   match: (path) => path === '/template-variable-docs' || path.startsWith('/template-variable-docs/'),
    // },
  ];

  const documentRoutes: IRouteConfig[] = [
    {
      key: 'documents',
      label: t('navigation.documents'),
      href: '/documents',
      icon: <Files className="size-6" />,
      match: (path) => path === '/documents' || path.startsWith('/documents/'),
    },
  ];

  const dashboardRoutes: IRouteConfig[] = [
    {
      key: 'dashboard',
      label: t('navigation.dashboard'),
      href: '/dashboard',
      icon: <BarChart3 className="size-6" />,
      match: (path) => path === '/dashboard' || path.startsWith('/dashboard/'),
    },
  ];

  const agentSettingsRoute: IRouteConfig = {
    key: 'agent-settings',
    label: t('navigation.agentSettings'),
    href: '/settings',
    icon: <Settings className="size-6" />,
    match: (path) =>
      path === '/settings' || path.startsWith('/settings/') || path === '/openai' || path.startsWith('/openai/'),
  };

  const adminRoute: IRouteConfig = {
    key: 'admin',
    label: t('navigation.admin'),
    href: '/admin',
    icon: <Users className="size-6" />,
    match: (path) => path === '/admin' || path.startsWith('/admin/'),
  };

  const templateAgentRoute: IRouteConfig = {
    key: 'template-agent',
    label: t('navigation.templateAgent'),
    href: '/template-agent',
    icon: <Bot className="size-6" />,
    match: (path) => path === '/template-agent' || path.startsWith('/template-agent/'),
  };

  const documentInputAgentRoute: IRouteConfig = {
    key: 'document-input-agent',
    label: t('navigation.documentInputAgent'),
    href: '/document-input-agent',
    icon: <ClipboardPenLine className="size-6" />,
    match: (path) => path === '/document-input-agent' || path.startsWith('/document-input-agent/'),
  };

  const documentInputAgentHistoryRoute: IRouteConfig = {
    key: 'document-input-agent-history',
    label: t('navigation.documentInputAgentHistory'),
    href: '/document-input-agent-history',
    icon: <History className="size-6" />,
    match: (path) => path === '/document-input-agent-history' || path.startsWith('/document-input-agent-history/'),
  };

  const templateAgentRoutes =
    hasTechRootAccess && TECH_CONFIG_VARIABLE_ENABLED && agentSettings.template_agent_enabled
      ? [templateAgentRoute]
      : [];
  const isDocumentInputAgentEnabled = agentSettings.document_input_agent_enabled;
  const documentInputAgentRoutes =
    canUseDocumentInputAgent && isDocumentInputAgentEnabled ? [documentInputAgentRoute] : [];
  const documentInputAgentHistoryRoutes =
    hasRootAccess && isDocumentInputAgentEnabled ? [documentInputAgentHistoryRoute] : [];
  const agentSettingsRoutes = hasRootAccess ? [agentSettingsRoute] : [];

  const baseRoutes: IRouteConfig[] = [
    {
      key: 'home',
      label: t('navigation.home'),
      href: '/home',
      icon: <Home className="size-6" />,
      match: (path) => path === '/home' || path.startsWith('/home/'),
    },
    ...(hasDashboardAccess ? dashboardRoutes : []),
    ...(hasTemplateAccess ? templateRoutes : []),
    ...(hasTechRootAccess && TECH_CONFIG_VARIABLE_ENABLED ? techRootRoutes : []),
    ...templateAgentRoutes,
    ...(!isAdmin ? agentSettingsRoutes : []),
    ...(hasDocumentAccess ? documentRoutes : []),
    ...documentInputAgentRoutes,
  ];

  const defaultRoutes: IRouteConfig[] = isAdmin
    ? [...baseRoutes, ...documentInputAgentHistoryRoutes, adminRoute, ...agentSettingsRoutes]
    : baseRoutes;

  const shouldWaitForProfile = !routes && !profile;
  const routeList = shouldWaitForProfile ? [] : (routes ?? defaultRoutes);
  const { pathname } = useLocation();

  return (
    <aside
      className={`fixed bottom-0 left-0 top-16 z-30 flex flex-col border-r border-slate-200 bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-80'
      }`}>
      {/* <div
        className={`border-b border-slate-100 px-4 py-4 transition-all duration-300 ${
          isCollapsed ? 'flex justify-center' : ''
        }`}>
        {isCollapsed ? (
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#0B2559] text-white shadow-sm">
            <ShieldCheck className="size-5" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#0B2559] text-white shadow-sm">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{t('language.label')}</p>
              <p className="truncate text-xs text-slate-500">{t('app.title')}</p>
            </div>
          </div>
        )}
      </div> */}

      <nav className="flex flex-1 flex-col gap-1.5 px-4 py-4">
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
      <div className="mt-auto border-t border-slate-100 p-3">
        <button
          type="button"
          className={`flex w-full items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
          onClick={() => onCollapsedChange(!isCollapsed)}>
          {isCollapsed ? (
            <ArrowRightToLine className="size-4" />
          ) : (
            <div className="flex w-full items-center justify-between gap-3">
              <span className="text-base font-semibold">{t('navigation.collapse')}</span>
              <ArrowLeftToLine className="size-4" />
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};
