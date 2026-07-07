'use client';

import { useState } from 'react';
import { resetPasswordAction } from '../store/store-authentication/actions/reset-password.action';

export function useResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetPassword = async (email: string) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await resetPasswordAction({ email });

      if (result) {
        setSuccess(true);
        return true;
      } else {
        setError('Failed to reset password');
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
    resetPassword,
    isLoading,
    error,
    success,
  };
}
