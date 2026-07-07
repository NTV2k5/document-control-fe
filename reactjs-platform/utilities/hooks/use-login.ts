'use client';

import { CoreAuthenticationStore } from '../store';

export function useLogin() {
  const isLoading = CoreAuthenticationStore.isLoginLoading();

  const error = CoreAuthenticationStore.getLoginError();

  const handleLogin = async (username: string, password: string, rememberMe = false): Promise<boolean> => {
    return await CoreAuthenticationStore.loginAction({ username, password, rememberMe });
  };

  return {
    handleLogin,
    isLoading,
    error,
  };
}
