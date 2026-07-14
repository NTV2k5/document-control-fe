import { API } from '../api';

export interface IForceUpdateData {
  android: {
    minimum_version: string;
    latest_version: string;
    force_update: number;
    update_url: string;
    description: string;
    minimum_build_number: number;
  };
  ios: {
    minimum_version: string;
    latest_version: string;
    force_update: number;
    update_url: string;
    description: string;
    minimum_build_number: number;
  };
}

export interface IForceUpdateResponse {
  message: string;
  data: IForceUpdateData;
}

export const getForceUpdateAPI = (): Promise<IForceUpdateData> => {
  return API.get<IForceUpdateResponse>('/api/method/version.get_mobile_version').then(
    (response) => response.data.data,
  );
};
