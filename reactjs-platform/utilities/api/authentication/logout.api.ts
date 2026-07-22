import { API } from '../api';

export interface ILogoutResponse {
  message: string;
  data: Record<string, unknown>;
}

const API_COMMON = import.meta.env.VITE_API_COMMON || 'drive_edms.api';

export const logoutAPI = (): Promise<ILogoutResponse> => {
  return API.post<ILogoutResponse>(`/api/method/${API_COMMON}.authen.revoke_token`, {}).then((response) => response.data);
};
