import { API } from '../api';

export interface IExchangeTokenResponse {
  message: string;
  data: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
  };
}

export const exchangeTokenAPI = (token: string): Promise<IExchangeTokenResponse['data']> => {
  return API.post<IExchangeTokenResponse>('/api/method/edu_frappe_api.api.authen.exchange_token', {
    token,
  }).then((response) => response.data.data);
};
