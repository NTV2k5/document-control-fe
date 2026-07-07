export interface IUserProfileScopeAssignment {
  id: string;
  scope_type: 'GLOBAL' | 'TENANT' | 'ORG_UNIT' | 'ORG_UNIT_TREE' | 'OWN' | 'ASSIGNED' | 'PUBLIC';
  organization_unit_id: string | null;
  organization_unit_code?: string | null;
  organization_unit_name?: string | null;
  organization_unit_type?: string | null;
  conditions_json?: Record<string, unknown> | null;
  role: {
    role_key: string;
    role_name: string;
    level?: number;
  };
  permission_codes?: string[];
  is_primary: boolean;
}

/**
 * Represents a user profile returned by GET /api/v1/users/me
 *
 * user_type:
 *   2 = ADMIN  – creates templates, manages RBAC, approves, assigns users
 *   1 = USER   – views templates, submits documents for approval
 */
export interface IUserProfile {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  user_type: number;
  job: string;
  expertise: string[];
  profile_url: string;
  permission_codes: string[];
  scope_assignments: IUserProfileScopeAssignment[];
}
