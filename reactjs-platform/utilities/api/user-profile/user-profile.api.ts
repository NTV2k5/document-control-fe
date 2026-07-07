import type { IUserProfile } from '../../models';
import { API } from '..';

export const fetchUserProfileApi = (): Promise<IUserProfile> => {
  return API.get<{ data: IUserProfile }>('/api/v1/users/me').then((response) => response.data.data);
};
