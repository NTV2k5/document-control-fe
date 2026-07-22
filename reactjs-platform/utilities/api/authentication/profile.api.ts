import { admissionAPI } from '../api';

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

export interface IStudentInfo {
  name: string;
  student_code: string;
  faculty: string;
  faculty_name: string;
  major: string | null;
  major_name: string;
  mobile_no: string;
}

export interface IProfileData {
  active: boolean;
  full_name: string;
  first_name: string;
  last_name: string | null;
  email: string;
  mobile_no: string;
  role_profile: string;
  roles: string[];
  picture: string | null;
  is_deletion_requested?: number;
  is_changed: number;
  is_student?: boolean;
  student_info?: IStudentInfo | null;
  call_profile?: ICallProfile;
  counters?: ICounters;
}

export interface IProfileResponse {
  message: string;
  data: IProfileData;
}

export const getProfileAPI = (token: string): Promise<IProfileResponse['data']> => {
  return admissionAPI
    .get<IProfileResponse>('/api/method/authen.get_profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .then((response) => response.data.data);
};
