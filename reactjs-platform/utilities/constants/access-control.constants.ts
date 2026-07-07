/**
 * User type constants – mirrors the user_type field in IUserProfile.
 * Source of truth: Keycloak group (ADMIN | USER),
 * returned as user_type number by GET /api/v1/users/me.
 */
export const USER_TYPE = {
  ADMIN: 2,
  USER: 1,
} as const;

export type UserType = (typeof USER_TYPE)[keyof typeof USER_TYPE];
