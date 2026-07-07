'use client';

import { createContext, useContext } from 'react';

interface AuthContextType {
  isInitialized: boolean;
  isPublicRoute: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
