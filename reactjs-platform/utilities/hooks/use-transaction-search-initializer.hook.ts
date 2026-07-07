'use client';

import { useLocation } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useProfile } from './use-profile';

export interface UseTransactionSearchInitializerResult {
  initialSearchQuery: string;
  isReady: boolean;
}

/**
 * Reads the initial transaction search query from the current URL.
 * Transaction fetching should be handled per-feature using the user's id,
 * not partner_code (which no longer exists in the profile).
 */
export const useTransactionSearchInitializer = (): UseTransactionSearchInitializerResult => {
  const { profile } = useProfile();
  const searchStr = useLocation({
    select: (location) => location.searchStr,
  });

  const initialSearchQuery = useMemo(() => {
    const searchParams = new URLSearchParams(searchStr);
    return searchParams.get('key_search') ?? '';
  }, [searchStr]);

  return {
    initialSearchQuery,
    isReady: !!profile,
  };
};
