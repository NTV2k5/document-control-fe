export interface ILoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface IRegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface IChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface IResetPasswordData {
  email: string;
}

export interface IAuthenticationStore {
  isFetchingAuthentication: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  fetchingAuthenticationError: string | null;
}
