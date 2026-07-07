import { CoreAuthenticationStore, CoreUserProfileStore } from 'reactjs-platform/utilities/store';

export const useChangePassword = () => {
  const profile = CoreUserProfileStore.getProfileSelector();

  const loadingSelector = CoreAuthenticationStore.isChangePasswordLoading();

  return {
    profile,
    loadingSelector,
    changePassword: CoreAuthenticationStore.changePasswordAction,
  };
};
