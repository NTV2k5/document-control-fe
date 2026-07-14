export interface ILoginResponseData {
  user: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  is_first_login: boolean;
  token_type: string;
}

export interface ILoginResponse {
  message: string;
  data: ILoginResponseData;
}
