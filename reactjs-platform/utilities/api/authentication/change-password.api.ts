import { API } from '../api';

export interface IChangePasswordResponse {
  message: string;
  data: Record<string, unknown>;
}

export function changePasswordApi(old_password: string, new_password: string): Promise<IChangePasswordResponse> {
  return API.post<IChangePasswordResponse>('/api/method/authen.change_password', {
    old_password,
    new_password,
  }).then((response) => response.data);
}
