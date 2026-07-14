import axios from 'axios';

const ADMISSION_CRM_ENDPOINT = 'https://admission-crm-dev.giadinh.edu.vn';

const admissionAxios = axios.create({
  baseURL: ADMISSION_CRM_ENDPOINT,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ICallProfile {
  ws_url: string;
  sip_uri: string;
  display_name: string;
  auth_user: string;
  password: string;
  domain: string;
}

export interface ICounters {
  leads: number;
  calls: number;
  enrollments: number;
}

export interface IProfileData {
  active: boolean;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile_no: string;
  role_profile: string;
  roles: string[];
  level: number;
  picture: string;
  is_changed: number;
  call_profile: ICallProfile;
  counters: ICounters;
}

export interface IProfileResponse {
  message: string;
  data: IProfileData;
}

export const getProfileAPI = (token: string): Promise<IProfileData> => {
  return admissionAxios
    .get<IProfileResponse>('/api/method/authen.get_profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .then((response) => response.data.data);
};
