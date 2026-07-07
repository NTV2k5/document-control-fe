import { CookieService } from 'reactjs-platform/utilities/cookie-storage';
import { decodePayload } from '../utils';

export class AuthTokenService {
  static getPermissions(): string[] {
    const token = CookieService.getItem('access_token');
    const payload = token ? decodePayload(token) : {};
    return payload?.groups ?? [];
  }

  static hasPermission(groups: string): boolean {
    return AuthTokenService.getPermissions().includes(groups);
  }

  static hasAnyPermission(groups: string[]): boolean {
    const userPermissions = AuthTokenService.getPermissions();
    return groups.some((p) => userPermissions.includes(p));
  }
}
