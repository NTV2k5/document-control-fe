import type { IUserProfile } from '../../models';
import { API } from '..';

import type { IProfileResponse } from '../authentication/profile.api';

const API_COMMON = import.meta.env.VITE_API_COMMON || 'drive_edms.api';

export const fetchUserProfileApi = (): Promise<IUserProfile> => {
  return API.post<IProfileResponse>(`/api/method/${API_COMMON}.authen.get_profile`)
    .then((response) => {
      const body = response.data as any;

      if (import.meta.env.DEV) {
        console.log('[user profile API] raw response body:', JSON.stringify(body).slice(0, 300));
      }

      const data = body?.data || body?.message || body;

      const roles = (data?.roles || []) as string[];
      const isAdminUser =
        roles.includes('Administrator') ||
        roles.includes('System Manager') ||
        roles.includes('ROOT') ||
        roles.includes('UNIVERSITY_ADMIN') ||
        roles.includes('DEAN');

      const userProfile: IUserProfile = {
        id: data?.email || 'unknown',
        username: data?.email ? data.email.split('@')[0] : 'unknown',
        email: data?.email || '',
        full_name: data?.full_name || '',
        first_name: data?.first_name || '',
        last_name: data?.last_name || '',
        phone_number: data?.mobile_no || '',
        user_type: isAdminUser ? 2 : 1, // 2 = ADMIN, 1 = USER
        job: data?.role_profile || '',
        role_profile: data?.role_profile || '',
        is_student: data?.is_student ?? (data?.role_profile === 'Student'),
        student_info: data?.student_info || null,
        expertise: [],
        profile_url: data?.picture || '',
        permission_codes: isAdminUser
          ? [
              'TECH_ROOT',
              'ADMIN',
              'ROOT',
              'MANAGE_USERS',
              'ACCESS_TEMPLATES',
              'ACCESS_DOCUMENTS',
              'ACCESS_DASHBOARD',
              'template.create',
              'template.update',
              'template.delete',
              'template.submit',
              'template.approve',
              'template.reject',
              'template.publish',
              'template.archive',
              'document.view',
              'document.create',
              'document.update',
              'document.delete',
              'document.submit',
              'document.approve',
              'document.reject',
              'document.publish',
              'document.unpublish',
              'user.view',
              'user.create',
              'user.update',
              'user.delete',
              'user.disable',
              'user.assign_role',
              'user.revoke_role',
            ]
          : [
              'ACCESS_TEMPLATES',
              'ACCESS_DOCUMENTS',
              'document.view',
              'document.create',
              'document.update',
              'document.submit',
            ],
        scope_assignments: roles.map((r, index) => ({
          id: `role-${index}`,
          scope_type: 'GLOBAL',
          organization_unit_id: null,
          is_primary: index === 0,
          role: {
            role_key: r.toUpperCase(),
            role_name: r,
            level: r.toUpperCase() === 'ROOT' ? 100 : 50,
          },
          permission_codes: isAdminUser ? ['user.assign_role', 'tech-root'] : [],
        })),
      };

      return userProfile;
    });
};
