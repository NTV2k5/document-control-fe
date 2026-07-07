'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminListKeycloakAccountsAPI, adminSyncKeycloakAccountAPI, type IKeycloakAccount } from '../api/admin';

interface UseKeycloakAccountsState {
  accounts: IKeycloakAccount[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  isLoading: boolean;
  error: string | null;
}

export function useKeycloakAccounts() {
  const [state, setState] = useState<UseKeycloakAccountsState>({
    accounts: [],
    total: 0,
    page: 1,
    pageSize: 20,
    search: '',
    isLoading: false,
    error: null,
  });

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchAccounts = useCallback(
    async (page = state.page, search = state.search) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const res = await adminListKeycloakAccountsAPI({
          search: search || undefined,
          page,
          page_size: state.pageSize,
        });
        setState((prev) => ({
          ...prev,
          accounts: res.data,
          total: res.pagination.total,
          page: res.pagination.page,
          pageSize: res.pagination.page_size,
          search,
          isLoading: false,
        }));
      } catch (e: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: e?.response?.data?.message ?? e?.message ?? 'Failed to load Keycloak accounts',
        }));
      }
    },
    [state.page, state.search, state.pageSize],
  );

  useEffect(() => {
    fetchAccounts(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSearch = (search: string) => fetchAccounts(1, search);
  const setPage = (page: number) => fetchAccounts(page, state.search);

  const syncAccount = async (id: string) => {
    setActionLoadingId(id);
    setActionError(null);
    try {
      const result = await adminSyncKeycloakAccountAPI(id);
      await fetchAccounts(state.page, state.search);
      return result;
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Failed to sync Keycloak account';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
      return null;
    } finally {
      setActionLoadingId(null);
    }
  };

  return {
    accounts: state.accounts,
    total: state.total,
    page: state.page,
    pageSize: state.pageSize,
    search: state.search,
    isLoading: state.isLoading,
    error: state.error,
    actionLoadingId,
    actionError,
    clearActionError: () => setActionError(null),
    fetchAccounts,
    setSearch,
    setPage,
    syncAccount,
  };
}
