import { API } from 'reactjs-platform/utilities/api';
import type { IProfileDashboardData, IUpdateProfilePayload, IUpdateProfileResponse } from './profile.type';

export const getProfileDashboardAPI = async (): Promise<IProfileDashboardData> => {
  const API_COMMON = import.meta.env.VITE_API_COMMON || 'drive_edms.api';
  return API.get<{ message: IProfileDashboardData }>(
    `/api/method/${API_COMMON}.profile.get_profile_dashboard`,
  ).then((response) => response.data.message);
};

export const updateProfileAPI = async (
  payload: IUpdateProfilePayload,
): Promise<IUpdateProfileResponse> => {
  const API_COMMON = import.meta.env.VITE_API_COMMON || 'drive_edms.api';
  return API.put<{ message: IUpdateProfileResponse }>(
    `/api/method/${API_COMMON}.profile.update_profile`,
    payload,
  ).then((response) => response.data.message);
};
