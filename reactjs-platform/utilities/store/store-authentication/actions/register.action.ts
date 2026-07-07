import type { IRegisterData } from '../authentication.types';
import { authenticationStore } from '../authentication.store';

export const registerAction = async (data: IRegisterData): Promise<boolean> => {
  authenticationStore.setState({ isFetchingAuthentication: true, fetchingAuthenticationError: null });

  try {
    if (data.password !== data.confirmPassword) {
      authenticationStore.setState({
        isFetchingAuthentication: false,
        fetchingAuthenticationError: 'Passwords do not match',
      });
      return false;
    }

    authenticationStore.setState({
      isFetchingAuthentication: false,
      isAuthenticated: true,
      accessToken: `mock-access-token-${Date.now()}`,
      fetchingAuthenticationError: null,
    });

    return true;
  } catch {
    authenticationStore.setState({
      isFetchingAuthentication: false,
      fetchingAuthenticationError: 'An error occurred during registration',
    });
    return false;
  }
};

export const isRegisterLoading = (): boolean => {
  return authenticationStore.getState().isFetchingAuthentication;
};

export const getRegisterError = (): string | null => {
  return authenticationStore.getState().fetchingAuthenticationError;
};
