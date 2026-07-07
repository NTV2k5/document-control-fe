import { API } from '../api';

export interface IRegisterPayload {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface IRegisterResponse {
  user_id: string;
  username: string;
  message: string;
}

export const registerAPI = (payload: IRegisterPayload): Promise<IRegisterResponse> => {
  return API.post<{ data: IRegisterResponse }>('/api/v1/auth/register', payload, {
    headers: { 'Content-Type': 'application/json', 'clean-request': 'no-clean' },
  }).then((response) => response.data.data);
};
