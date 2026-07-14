import type { ILoginResponseData, ILoginResponse } from '../../models/login-response.model';
import { pureAxios } from '../pure-axios';

export const refreshTokenAPI = (refreshToken: string): Promise<ILoginResponseData> => {
  const formData = new URLSearchParams();
  formData.append('grant_type', 'refresh_token');
  formData.append('refresh_token', refreshToken);

  return pureAxios
    .post<ILoginResponse>(
      '/api/method/authen.get_token',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )
    .then((response) => response.data.data);
};
