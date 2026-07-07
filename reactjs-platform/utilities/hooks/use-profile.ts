'use client';

import type { IChangePasswordData } from '../store/store-authentication/authentication.types';
import { useState } from 'react';
import { CoreUserProfileStore } from '../store';
import { changePasswordAction } from '../store/store-authentication/actions/change-password.action';

export function useProfile() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const changePassword = async (data: IChangePasswordData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await changePasswordAction(data);

      if (result) {
        setSuccess(true);
        return true;
      } else {
        setError('Failed to change password');
        return false;
      }
    } catch {
      setError('An unexpected error occurred');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    changePassword,
    profile: CoreUserProfileStore.getProfileSelector(),
    isLoading,
    error,
    success,
  };
}
