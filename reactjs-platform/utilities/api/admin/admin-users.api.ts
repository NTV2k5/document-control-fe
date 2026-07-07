import { API } from '../api';
import type { IPagination } from '../api.type';

// ─── Types ────────────────────────────────────────────────────────────────────

import type { ScopeType } from './admin-rbac.api';

export type UserRole = 'ADMIN' | 'USER';

export interface IUserScopeAssignmentSummary {
  id: string;
  scope_type: ScopeType;
  organization_unit_id: string | null;
  organization_unit_code?: string | null;
  organization_unit_name?: string | null;
  organization_unit_type?: string | null;
  is_primary: boolean;
  role: {
    role_id: string;
    role_key: string;
    role_name: string;
    level?: number;
  };
  permission_codes?: string[];
}

export interface IUserManagerSummary {
  user_id: string;
  username: string;
  email: string;
  display_name: string;
  role_keys: string[];
  organization_unit_name: string | null;
  scope_type: ScopeType;
}

export interface IAdminUser {
  id: string;
  db_user_id?: string | null;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  enabled: boolean;
  email_verified: boolean;
  created_at: string | null;
  role: UserRole;
  user_type: number; // 2=ADMIN, 1=USER
  role_keys?: string[];
  scope_assignments?: IUserScopeAssignmentSummary[];
  managed_by?: IUserManagerSummary[];
}

export interface IKeycloakAccount {
  id: string;
  db_user_id?: string | null;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  enabled: boolean;
  email_verified: boolean;
  created_at: string | null;
  synced: boolean;
  synced_role?: UserRole | null;
  sync_blocked_reason?: string | null;
}

export interface IAdminCreateUserPayload {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  role_keys?: string[];
  scope_type?: ScopeType;
  organization_unit_id?: string;
}

export interface IAdminUpdateUserPayload {
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface IAdminListUsersParams {
  search?: string;
  page?: number;
  page_size?: number;
  sort?: string;
  organization_unit_id?: string;
  include_subtree?: boolean;
  exclude_unit_id?: string;
  role_id?: string;
  enabled?: boolean;
}

export interface IAdminListKeycloakAccountsParams {
  search?: string;
  page?: number;
  page_size?: number;
}

export const adminListUsersAPI = (
  params?: IAdminListUsersParams,
): Promise<{ data: IAdminUser[]; pagination: IPagination }> => {
  return API.get<{ data: IAdminUser[]; pagination: IPagination }>('/api/v1/admin/users', { params }).then(
    (response) => response.data,
  );
};

export const adminListKeycloakAccountsAPI = (
  params?: IAdminListKeycloakAccountsParams,
): Promise<{ data: IKeycloakAccount[]; pagination: IPagination }> => {
  return API.get<{ data: IKeycloakAccount[]; pagination: IPagination }>('/api/v1/admin/keycloak-users', {
    params,
  }).then((response) => response.data);
};

export const adminSyncKeycloakAccountAPI = (id: string): Promise<IAdminUser> => {
  return API.post<{ data: IAdminUser }>(`/api/v1/admin/keycloak-users/${id}/sync`).then(
    (response) => response.data.data,
  );
};

// ─── Get one user ─────────────────────────────────────────────────────────────

export const adminGetUserAPI = (id: string): Promise<IAdminUser> => {
  return API.get<{ data: IAdminUser }>(`/api/v1/admin/users/${id}`).then((response) => response.data.data);
};

// ─── Create user ──────────────────────────────────────────────────────────────

export const adminCreateUserAPI = (
  payload: IAdminCreateUserPayload,
): Promise<{ id: string; username: string; role: UserRole }> => {
  return API.post<{ data: { id: string; username: string; role: UserRole } }>('/api/v1/admin/users', payload).then(
    (response) => response.data.data,
  );
};

// ─── Update user ──────────────────────────────────────────────────────────────

export const adminUpdateUserAPI = (id: string, payload: IAdminUpdateUserPayload): Promise<IAdminUser> => {
  return API.patch<{ data: IAdminUser }>(`/api/v1/admin/users/${id}`, payload).then((response) => response.data.data);
};

// ─── Delete user ──────────────────────────────────────────────────────────────

export const adminDeleteUserAPI = (id: string): Promise<void> => {
  return API.delete(`/api/v1/admin/users/${id}`).then(() => undefined);
};

// ─── Reset password ───────────────────────────────────────────────────────────

export const adminResetPasswordAPI = (id: string, new_password: string): Promise<void> => {
  return API.post(`/api/v1/admin/users/${id}/reset-password`, { new_password }).then(() => undefined);
};

// ─── Assign role ──────────────────────────────────────────────────────────────

export const adminAssignRoleAPI = (id: string, role: UserRole): Promise<{ role: UserRole }> => {
  return API.post<{ data: { role: UserRole } }>(`/api/v1/admin/users/${id}/role`, {
    role,
  }).then((response) => response.data.data);
};

// ─── Enable / Disable ─────────────────────────────────────────────────────────

export const adminEnableUserAPI = (id: string): Promise<void> => {
  return API.patch(`/api/v1/admin/users/${id}/enable`).then(() => undefined);
};

export const adminDisableUserAPI = (id: string): Promise<void> => {
  return API.patch(`/api/v1/admin/users/${id}/disable`).then(() => undefined);
};
