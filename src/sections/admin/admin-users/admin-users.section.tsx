'use client';

import { useMemo, useState } from 'react';
import { Users, ShieldCheck, KeyRound, Database, Home, Building2, GitBranch, UserRoundCheck } from 'lucide-react';
import { UsersTab } from '../users-tab';
import { KeycloakAccountsTab } from '../keycloak-accounts-tab';
import { RolesTab } from '../roles-tab';
import { AuthorizationTab } from '../authorization-tab';
import { OrgAccessTab } from '../org-access-tab';
import { SeedTab } from '../seed-tab';
import { ApprovalFlowTab } from '../approval-flow-tab';
import { profileStore, hasAnyPermission, hasPermission, isRootProfile } from 'reactjs-platform/utilities';
import { AdminUsersContext } from './admin-users.context';
import type { IAdminUsersSectionProps, IAdminUsersTabOption, TAdminUsersTab } from './admin-users.type';
import type React from 'react';
import { useTranslation } from '../../../i18n';

const BASE_TABS: IAdminUsersTabOption[] = [
  { id: 'users', label: 'adminUsers.tabs.users', icon: <Users className="size-4" /> },
  {
    id: 'keycloak-accounts',
    label: 'adminUsers.tabs.keycloakAccounts',
    icon: <UserRoundCheck className="size-4" />,
  },
  { id: 'org-access', label: 'adminUsers.tabs.orgAccess', icon: <Building2 className="size-4" /> },
  { id: 'roles', label: 'adminUsers.tabs.roles', icon: <ShieldCheck className="size-4" /> },
  { id: 'authorization', label: 'adminUsers.tabs.authorization', icon: <KeyRound className="size-4" /> },
  { id: 'approval-flow', label: 'adminUsers.tabs.approvalFlow', icon: <GitBranch className="size-4" /> },
];

const DEV_ONLY_TABS: IAdminUsersTabOption[] = [
  { id: 'seed', label: 'adminUsers.tabs.seed', icon: <Database className="size-4" /> },
];

export const AdminUsersSection: React.FC<IAdminUsersSectionProps> = () => {
  const { t } = useTranslation();
  const profile = profileStore((state) => state.profile);
  const availableTabs = useMemo(() => {
    const tabs: IAdminUsersTabOption[] = [];

    if (
      hasAnyPermission(profile, [
        'user.view',
        'user.create',
        'user.update',
        'user.delete',
        'user.disable',
        'user.assign_role',
        'user.revoke_role',
      ])
    ) {
      tabs.push(BASE_TABS[0]);
    }

    if (isRootProfile(profile)) {
      tabs.push(BASE_TABS[1]);
    }

    if (hasAnyPermission(profile, ['organization.view', 'user.assign_role', 'user.revoke_role'])) {
      tabs.push(BASE_TABS[2]);
    }

    if (hasPermission(profile, 'role.view')) {
      tabs.push(BASE_TABS[3]);
    }

    if (
      hasAnyPermission(profile, [
        'organization.view',
        'organization.create',
        'organization.update',
        'organization.delete',
        'role.view',
      ])
    ) {
      tabs.push(BASE_TABS[4]);
    }

    if (hasAnyPermission(profile, ['approval.view', 'approval.config'])) {
      tabs.push(BASE_TABS[5]);
    }

    if (import.meta.env.DEV) {
      tabs.push(...DEV_ONLY_TABS);
    }

    return tabs;
  }, [profile]);

  const [activeTab, setActiveTab] = useState<TAdminUsersTab>(availableTabs[0]?.id ?? 'users');
  const tabs = availableTabs;

  const resolvedActiveTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : (tabs[0]?.id ?? null);

  return (
    <AdminUsersContext.Provider value={{ setActiveTab }}>
      <div className="flex min-h-screen flex-col bg-gray-50 p-6">
        {tabs.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            {t('adminUsers.noAccess')}
          </div>
        )}

        {tabs.length > 0 && (
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-sm">
                <span className="flex items-center gap-1 text-amber-600">
                  <Home className="size-3.5" />
                  <span className="font-medium">{t('adminUsers.breadcrumbRoot')}</span>
                </span>
                <span className="text-gray-400">›</span>
                <span className="text-gray-500">
                  {resolvedActiveTab === 'approval-flow'
                    ? t('adminUsers.approvalFlowTitle')
                    : t('adminUsers.userManagementTitle')}
                </span>
              </div>
              <div className="text-3xl font-bold text-[#0B2559]">
                {resolvedActiveTab === 'approval-flow'
                  ? t('adminUsers.approvalFlowTitle')
                  : t('adminUsers.userManagementTitle')}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {resolvedActiveTab === 'approval-flow'
                  ? t('adminUsers.approvalFlowDescription')
                  : t('adminUsers.userManagementDescription')}
              </p>
            </div>
          </div>
        )}

        {/* Top tab bar */}
        {tabs.length > 0 && (
          <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <nav className="flex gap-1 border-b border-slate-100 px-6">
              {tabs.map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-sm font-medium transition-colors ${
                    resolvedActiveTab === tab.id
                      ? 'border-[#002147] text-[#002147]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  {tab.icon}
                  {t(tab.label)}
                </button>
              ))}
            </nav>
            <div className="flex-1">{resolvedActiveTab === 'users' && <UsersTab />}</div>
            <div className="flex-1">{resolvedActiveTab === 'keycloak-accounts' && <KeycloakAccountsTab />}</div>
            <div className="flex-1">{resolvedActiveTab === 'org-access' && <OrgAccessTab />}</div>
            <div className="flex-1">{resolvedActiveTab === 'roles' && <RolesTab />}</div>
            <div className="flex-1">{resolvedActiveTab === 'authorization' && <AuthorizationTab />}</div>
            <div className="flex-1">{resolvedActiveTab === 'approval-flow' && <ApprovalFlowTab />}</div>
            {import.meta.env.DEV && resolvedActiveTab === 'seed' && <SeedTab />}
          </div>
        )}
      </div>
    </AdminUsersContext.Provider>
  );
};
