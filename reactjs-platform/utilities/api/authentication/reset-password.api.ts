import { API } from '../api';

export interface IResetPasswordResponse {
  message: string;
  data: Record<string, unknown>;
}

export const resetPasswordAPI = (email: string): Promise<IResetPasswordResponse> => {
  const formData = new URLSearchParams();
  formData.append('email', email);

  return API.post<IResetPasswordResponse>('/api/method/authen.reset_password', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  }).then((response) => response.data);
};
