import type { ILoginResponseData, ILoginResponse } from '../../models/login-response.model';
import { pureAxios } from '../pure-axios';

const API_COMMON = import.meta.env.VITE_API_COMMON || 'drive_edms.api';

export const refreshTokenAPI = (refreshToken: string): Promise<ILoginResponseData> => {
  const formData = new URLSearchParams();
  formData.append('grant_type', 'refresh_token');
  formData.append('refresh_token', refreshToken);

  return pureAxios
    .post<ILoginResponse>(
      `/api/method/${API_COMMON}.authen.get_token`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )
    .then((response) => response.data.data);
};
