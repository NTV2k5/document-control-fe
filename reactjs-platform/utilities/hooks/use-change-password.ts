import { changePasswordAction } from '../store/store-authentication/actions/change-password.action';
import { authenticationStore } from '../store/store-authentication/authentication.store';

export function useChangePassword() {
  const loadingSelector = authenticationStore(
    (state: { isFetchingAuthentication: any }) => state.isFetchingAuthentication,
  );

  const changePassword = async (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<boolean> => {
    return await changePasswordAction(data);
  };

  return {
    changePassword,
    loadingSelector,
  };
}
