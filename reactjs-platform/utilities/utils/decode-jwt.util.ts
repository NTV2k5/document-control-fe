import { jwtDecode } from 'jwt-decode';

export interface DecodedAuthPayload {
  groups?: string[];
  realm_access?: {
    roles?: string[];
  };
  resource_access?: Record<string, { roles?: string[] }>;
  // local JWT fields
  user_type?: number;
  role_key?: string;
  scope_type?: string;
  [key: string]: unknown;
}

export const decodePayload = (token: string): DecodedAuthPayload => {
  try {
    return jwtDecode(token);
  } catch {
    return {};
  }
};
