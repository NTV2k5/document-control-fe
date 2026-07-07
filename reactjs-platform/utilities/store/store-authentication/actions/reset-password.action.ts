import type { IResetPasswordData } from '../authentication.types';
import { authenticationStore } from '../authentication.store';

// Reset password action
export const resetPasswordAction = async (data: IResetPasswordData): Promise<boolean> => {
  console.log(data);

  authenticationStore.setState({ isFetchingAuthentication: true, fetchingAuthenticationError: null });

  try {
    authenticationStore.setState({ isFetchingAuthentication: false });
    return true;
  } catch {
    authenticationStore.setState({
      isFetchingAuthentication: false,
      fetchingAuthenticationError: 'An error occurred while resetting password',
    });
    return false;
  }
};

export const isResetPasswordLoading = (): boolean => {
  return authenticationStore.getState().isFetchingAuthentication;
};

export const getResetPasswordError = (): string | null => {
  return authenticationStore.getState().fetchingAuthenticationError;
};
