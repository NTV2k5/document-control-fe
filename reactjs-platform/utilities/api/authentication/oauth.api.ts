import { admissionAPI } from '../api';
import type { IExchangeTokenResponse } from './exchange-token.api';

export interface IMicrosoftOAuthUrlParams {
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: 'S256';
}

export interface IMicrosoftOAuthUrlResponse {
  authorization_url: string;
}

export interface IMicrosoftOAuthTokenPayload {
  code: string;
  redirect_uri: string;
  code_verifier: string;
}

export const getMicrosoftOAuthUrlAPI = (params: IMicrosoftOAuthUrlParams): Promise<IMicrosoftOAuthUrlResponse> => {
  return admissionAPI
    .get<{ message: string; data: IMicrosoftOAuthUrlResponse }>('/api/method/authen.microsoft_oauth_url', {
      params,
    })
    .then((response) => response.data.data);
};

export const exchangeMicrosoftOAuthCodeAPI = (
  payload: IMicrosoftOAuthTokenPayload,
): Promise<IExchangeTokenResponse['data']> => {
  return admissionAPI
    .post<IExchangeTokenResponse>('/api/method/authen.microsoft_exchange_token', payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then((response) => response.data.data);
};
