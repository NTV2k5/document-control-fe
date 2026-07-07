export interface ISignInSectionProps {
  data?: Record<string, unknown>;
}

export interface ILoginFormModel {
  username?: string;
  password?: string;
}

export interface ISignInSearchParams {
  backUrl?: string;
  code?: string;
  error?: string;
  error_description?: string;
  iss?: string;
  session_state?: string;
  state?: string;
}

export interface IUserData {
  user?: string;
  fullname?: string;
  pass?: string;
  email?: string;
  signature?: string;
}

export type ISignIn = ISignInSectionProps;
