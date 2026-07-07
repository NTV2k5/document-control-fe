import type { ILoginResponseData } from './refresh-token.api';
import { API } from '../api';

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
  return API.get<{ data: IMicrosoftOAuthUrlResponse }>('/api/v1/auth/oauth/microsoft/url', {
    params,
    headers: {
      'clean-request': 'no-clean',
    },
  }).then((response) => response.data.data);
};

export const exchangeMicrosoftOAuthCodeAPI = (payload: IMicrosoftOAuthTokenPayload): Promise<ILoginResponseData> => {
  return API.post<{ data: ILoginResponseData }>('/api/v1/auth/oauth/microsoft/token', payload, {
    headers: {
      'Content-Type': 'application/json',
      'clean-request': 'no-clean',
    },
  }).then((response) => response.data.data);
};
