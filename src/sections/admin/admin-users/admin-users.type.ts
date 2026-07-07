import type React from 'react';

export interface IAdminUsersSectionProps {}

export type TAdminUsersTab =
  | 'users'
  | 'keycloak-accounts'
  | 'org-access'
  | 'roles'
  | 'authorization'
  | 'approval-flow'
  | 'seed';

export interface IAdminUsersTabOption {
  id: TAdminUsersTab;
  label: string;
  icon: React.ReactNode;
}
