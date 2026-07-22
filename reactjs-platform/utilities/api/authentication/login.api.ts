import type { ILoginResponseData, ILoginResponse } from '../../models/login-response.model';
import { API } from '../api';

const API_COMMON = import.meta.env.VITE_API_COMMON || 'drive_edms.api';

export const loginAPI = (username: string, password: string): Promise<ILoginResponseData> => {
  const formData = new URLSearchParams();
  formData.append('grant_type', 'password');
  formData.append('username', username);
  formData.append('password', password);

  return API.post<ILoginResponse>(
    `/api/method/${API_COMMON}.authen.get_token`,
    formData,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'clean-request': 'no-clean',
      },
    },
  ).then((response) => response.data.data);
};
