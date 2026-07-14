import { API } from '../api';

export interface ILogoutResponse {
  message: string;
  data: Record<string, unknown>;
}

export const logoutAPI = (): Promise<ILogoutResponse> => {
  return API.post<ILogoutResponse>('/api/method/authen.revoke_token', {}).then((response) => response.data);
};
