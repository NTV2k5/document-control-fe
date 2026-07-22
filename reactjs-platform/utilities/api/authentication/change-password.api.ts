import { API } from '../api';

export interface IChangePasswordResponse {
  message: string;
  data: Record<string, unknown>;
}

const API_COMMON = import.meta.env.VITE_API_COMMON || 'drive_edms.api';

export function changePasswordApi(old_password: string, new_password: string): Promise<IChangePasswordResponse> {
  return API.post<IChangePasswordResponse>(
    `/api/method/${API_COMMON}.authen.change_password`,
    {
      old_password,
      new_password,
    },
    {
      headers: {
        'clean-request': 'no-clean',
      },
    },
  ).then((response) => response.data);
}
