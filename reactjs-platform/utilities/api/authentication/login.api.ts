import type { ILoginResponseData } from './refresh-token.api';
import { API } from '../api';

export const loginAPI = (username: string, password: string): Promise<ILoginResponseData> => {
  return API.post<{ data: ILoginResponseData }>(
    '/api/v1/auth/login',
    { username, password },
    {
      headers: {
        'Content-Type': 'application/json',
        'clean-request': 'no-clean',
      },
    },
  ).then((response) => response.data.data);
};
