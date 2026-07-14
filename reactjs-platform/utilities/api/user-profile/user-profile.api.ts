import type { IUserProfile } from '../../models';
import { API } from '..';

import type { IProfileResponse } from '../authentication/profile.api';

export const fetchUserProfileApi = (): Promise<IUserProfile> => {
  return API.get<IProfileResponse>('/api/method/authen.get_profile')
    .then((response) => {
      const data = response.data.data;

      const roles = data.roles || [];
      const isAdminUser =
        roles.includes('Administrator') ||
        roles.includes('System Manager') ||
        roles.includes('ROOT') ||
        roles.includes('UNIVERSITY_ADMIN') ||
        roles.includes('DEAN');

      const userProfile: IUserProfile = {
        id: data.email || 'unknown',
        username: data.email ? data.email.split('@')[0] : 'unknown',
        email: data.email || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone_number: data.mobile_no || '',
        user_type: isAdminUser ? 2 : 1, // 2 = ADMIN, 1 = USER
        job: data.role_profile || '',
        expertise: [],
        profile_url: data.picture || '',
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
