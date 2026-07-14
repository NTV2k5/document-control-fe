import { admissionAPI } from '../api';

export interface ISignUpContact {
  full_name: string;
  phone_number: string;
  email: string;
  designation: string;
}

export interface ISignUpData {
  email: string;
  full_name: string;
  referral_code?: string;
  phone_number: string;
  sales_parent?: string;
  type?: string;
  department?: string;
  address?: string;
  student_id?: string;
  website?: string;
  business_type?: string;
  contract_sign_date?: string;
  contract_duration?: string;
  contacts?: ISignUpContact[];
}

export interface ISignUpResponse {
  message: string;
  data: {
    name: string;
    owner: string;
    creation: string;
    modified: string;
    modified_by: string;
    docstatus: number;
    idx: number;
    sales_user: string;
    sales_parent: string;
    phone_number: string;
    type: string;
    department: string;
    incentives: number;
    sent_email: number;
    doctype: string;
  };
}

export const signUpAPI = (data: ISignUpData, token?: string): Promise<ISignUpResponse['data']> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return admissionAPI
    .post<ISignUpResponse>('/api/method/authen.sign_up', data, {
      headers,
    })
    .then((response) => response.data.data);
};
