import { API } from '../api';

// NEW: Updated ScopeType with semantic scopes instead of hardcoded hierarchy
export type ScopeType = 'GLOBAL' | 'TENANT' | 'ORG_UNIT' | 'ORG_UNIT_TREE' | 'OWN' | 'ASSIGNED' | 'PUBLIC';

export interface IAuthorizationOverview {
  units: number;
  permissions: number;
  roles: number;
  assignments: number;
  supported_scopes: ScopeType[];
}

export interface IPermission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  module: string | null;
  resource: string | null;
  action: string | null;
  is_system: boolean;
  role_count?: number;
}

export interface IRolePermissionSummary {
  id: string;
  code: string;
  name: string;
}

export interface IRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  level: number;
  scope_type: ScopeType;
  member_count?: number;
  permission_count?: number;
  permissions?: IRolePermissionSummary[];
}

export interface IOrganizationUnit {
  id: string;
  code: string;
  name: string;
  unit_type: string;
  parent_id: string | null;
  parent_name?: string | null;
  is_active: boolean;
  sort_order: number;
  metadata?: Record<string, unknown> | null;
  child_count?: number;
  assignment_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface IUserScopeAssignment {
  id: string;
  user_id: string;
  username?: string | null;
  email?: string | null;
  role_id: string;
  role_key: string | null;
  role_name: string | null;
  role_level?: number;
  scope_type: ScopeType;
  organization_unit_id: string | null;
  organization_unit_code: string | null;
  organization_unit_name: string | null;
  organization_unit_type: string | null;
  is_primary: boolean;
  status: string;
  // NEW: Dynamic conditions and time-bounded access
  conditions_json?: Record<string, unknown> | null;
  start_at?: string | null;
  end_at?: string | null;
  is_active?: boolean;
  inherited_from_unit_id?: string | null;
  inherited_from_unit_name?: string | null;
  created_at: string;
}

export interface ICreatePermissionPayload {
  code: string;
  name: string;
  description?: string;
  module?: string;
  resource?: string;
  action?: string;
  is_system?: boolean;
}

export interface IUpdatePermissionPayload {
  name?: string;
  description?: string;
  module?: string;
  resource?: string;
  action?: string;
  is_system?: boolean;
}

export interface ICreateRolePayload {
  key: string;
  name: string;
  description?: string;
  level?: number;
  scope_type?: ScopeType;
  permission_codes?: string[];
}

export interface IUpdateRolePayload {
  name?: string;
  description?: string;
  level?: number;
  scope_type?: ScopeType;
  permission_codes?: string[];
}

export interface ICreateOrganizationUnitPayload {
  code: string;
  name: string;
  unit_type: string;
  parent_id?: string;
  sort_order?: number;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface IUpdateOrganizationUnitPayload {
  name?: string;
  unit_type?: string;
  parent_id?: string | null;
  sort_order?: number;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface IAssignUserScopePayload {
  role_id: string;
  scope_type: ScopeType;
  organization_unit_id?: string;
  is_primary?: boolean;
  // NEW: Dynamic conditions and time-bounded access
  conditions_json?: Record<string, unknown>;
  start_at?: string;
  end_at?: string;
  is_active?: boolean;
}

export interface ISeedOrganizationUnitPayload {
  code: string;
  name: string;
  unit_type: string;
  parent_code?: string;
  sort_order?: number;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ISeedPermissionPayload {
  code: string;
  name: string;
  description?: string;
  module?: string;
  resource?: string;
  action?: string;
  is_system?: boolean;
}

export interface ISeedRolePayload {
  key: string;
  name: string;
  description?: string;
  level: number;
  scope_type: ScopeType;
  permission_codes: string[];
  is_system?: boolean;
}

export interface ISeedUserPayload {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role_keys: string[];
  scope_type?: ScopeType;
  organization_unit_code?: string;
  is_primary?: boolean;
}

export interface ISeedRbacPayload {
  organization_units?: ISeedOrganizationUnitPayload[];
  permissions?: ISeedPermissionPayload[];
  roles?: ISeedRolePayload[];
  users?: ISeedUserPayload[];
}

export interface ISeedReport {
  message: string;
  organization_units: Array<{ code: string; name: string; unit_type: string; created: boolean }>;
  permissions: Array<{ code: string; created: boolean }>;
  roles: Array<{ key: string; name: string; created: boolean; permission_count: number }>;
  groups: Array<{ name: string; created: boolean }>;
  realm_roles: Array<{ name: string; created: boolean }>;
  accounts: Array<{
    id?: string;
    username: string;
    email?: string;
    created: boolean;
    role_keys: string[];
    scope_type?: ScopeType | string;
    organization_unit_code?: string | null;
    error?: string;
  }>;
}

export const adminGetAuthorizationOverviewAPI = async (): Promise<IAuthorizationOverview> => {
  const response = await API.get<{ data: IAuthorizationOverview }>('/api/v1/admin/authorization/overview');
  return response.data.data;
};

export const adminListPermissionsAPI = async (): Promise<IPermission[]> => {
  const response = await API.get<{ data: IPermission[] }>('/api/v1/admin/permissions');
  return response.data.data;
};

export const adminCreatePermissionAPI = async (payload: ICreatePermissionPayload): Promise<IPermission> => {
  const response = await API.post<{ data: IPermission }>('/api/v1/admin/permissions', payload);
  return response.data.data;
};

export const adminUpdatePermissionAPI = async (id: string, payload: IUpdatePermissionPayload): Promise<IPermission> => {
  const response = await API.patch<{ data: IPermission }>(`/api/v1/admin/permissions/${id}`, payload);
  return response.data.data;
};

export const adminDeletePermissionAPI = async (id: string): Promise<void> => {
  await API.delete(`/api/v1/admin/permissions/${id}`);
};

export const adminListRolesAPI = async (): Promise<IRole[]> => {
  const response = await API.get<{ data: IRole[] }>('/api/v1/admin/roles');
  return response.data.data;
};

export const adminCreateRoleAPI = async (payload: ICreateRolePayload): Promise<IRole> => {
  const response = await API.post<{ data: IRole }>('/api/v1/admin/roles', payload);
  return response.data.data;
};

export const adminUpdateRoleAPI = async (id: string, payload: IUpdateRolePayload): Promise<IRole> => {
  const response = await API.patch<{ data: IRole }>(`/api/v1/admin/roles/${id}`, payload);
  return response.data.data;
};

export const adminDeleteRoleAPI = async (id: string): Promise<void> => {
  await API.delete(`/api/v1/admin/roles/${id}`);
};

export interface IOrganizationUnitChild {
  id: string;
  code: string;
  name: string;
  unit_type: string;
  is_active: boolean;
}

export interface IOrganizationUnitDetail extends IOrganizationUnit {
  children: IOrganizationUnitChild[];
  assignments: IUserScopeAssignment[];
}

let pendingOrganizationUnitsRequest: Promise<IOrganizationUnit[]> | null = null;

export const adminListOrganizationUnitsAPI = async (): Promise<IOrganizationUnit[]> => {
  if (pendingOrganizationUnitsRequest) {
    return pendingOrganizationUnitsRequest;
  }

  pendingOrganizationUnitsRequest = API.get<{ data: IOrganizationUnit[] }>('/api/v1/admin/organization-units')
    .then((response) => response.data.data)
    .finally(() => {
      pendingOrganizationUnitsRequest = null;
    });

  return pendingOrganizationUnitsRequest;
};

export const adminGetOrganizationUnitAPI = async (
  id: string,
  opts: { include_subtree?: boolean } = {},
): Promise<IOrganizationUnitDetail> => {
  const response = await API.get<{ data: IOrganizationUnitDetail }>(`/api/v1/admin/organization-units/${id}`, {
    params: opts.include_subtree ? { include_subtree: true } : undefined,
  });
  return response.data.data;
};

export const adminCreateOrganizationUnitAPI = async (
  payload: ICreateOrganizationUnitPayload,
): Promise<IOrganizationUnit> => {
  const response = await API.post<{ data: IOrganizationUnit }>('/api/v1/admin/organization-units', payload);
  return response.data.data;
};

export const adminUpdateOrganizationUnitAPI = async (
  id: string,
  payload: IUpdateOrganizationUnitPayload,
): Promise<IOrganizationUnit> => {
  const response = await API.patch<{ data: IOrganizationUnit }>(`/api/v1/admin/organization-units/${id}`, payload);
  return response.data.data;
};

export const adminDeleteOrganizationUnitAPI = async (id: string, options?: { cascade?: boolean }): Promise<void> => {
  await API.delete(`/api/v1/admin/organization-units/${id}`, {
    params: options?.cascade ? { cascade: 'true' } : undefined,
  });
};

export interface IOrganizationUnitDeleteImpact {
  unit: { id: string; name: string; code: string };
  descendant_count: number;
  descendants: { id: string; name: string; unitType: string }[];
  active_assignment_count: number;
  requires_cascade: boolean;
}

export const adminGetOrganizationUnitDeleteImpactAPI = async (id: string): Promise<IOrganizationUnitDeleteImpact> => {
  const response = await API.get<{ data: IOrganizationUnitDeleteImpact }>(
    `/api/v1/admin/organization-units/${id}/delete-impact`,
  );
  return response.data.data;
};

export const adminGetUserScopesAPI = async (userId: string): Promise<IUserScopeAssignment[]> => {
  const response = await API.get<{ data: IUserScopeAssignment[] }>(`/api/v1/admin/users/${userId}/scopes`);
  return response.data.data;
};

export const adminAssignUserScopeAPI = async (
  userId: string,
  payload: IAssignUserScopePayload,
): Promise<IUserScopeAssignment> => {
  const response = await API.post<{ data: IUserScopeAssignment }>(`/api/v1/admin/users/${userId}/scopes`, payload);
  return response.data.data;
};

export const adminRemoveUserScopeAPI = async (userId: string, assignmentId: string): Promise<void> => {
  await API.delete(`/api/v1/admin/users/${userId}/scopes/${assignmentId}`);
};

export const getDefaultSeedConfigAPI = async (): Promise<ISeedRbacPayload> => {
  const response = await API.get<{ data: ISeedRbacPayload }>('/api/v1/seed/rbac/default-config');
  return response.data.data;
};

export const runSeedRbacAPI = async (payload?: ISeedRbacPayload): Promise<ISeedReport> => {
  const res = await API.post<ISeedReport>('/api/v1/seed', payload ?? {});
  return res.data;
};
