import { API } from '../api';

export function changePasswordApi(current_password: string, new_password: string) {
  return new Promise<void>((resolve, reject) => {
    API.post('/api/v1/users/change-password', { current_password, new_password })
      .then(() => resolve())
      .catch(reject);
  });
}
