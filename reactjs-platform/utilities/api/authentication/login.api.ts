import type { ILoginResponseData, ILoginResponse } from '../../models/login-response.model';
import { API } from '../api';

export const loginAPI = (username: string, password: string): Promise<ILoginResponseData> => {
  const formData = new URLSearchParams();
  formData.append('grant_type', 'password');
  formData.append('username', username);
  formData.append('password', password);

  return API.post<ILoginResponse>(
    '/api/method/authen.get_token',
    formData,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'clean-request': 'no-clean',
      },
    },
  ).then((response) => response.data.data);
};
