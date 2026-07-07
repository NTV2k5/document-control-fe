'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminListUsersAPI,
  adminCreateUserAPI,
  adminUpdateUserAPI,
  adminDeleteUserAPI,
  adminResetPasswordAPI,
  adminAssignRoleAPI,
  adminEnableUserAPI,
  adminDisableUserAPI,
  type IAdminUser,
  type IAdminCreateUserPayload,
  type IAdminUpdateUserPayload,
  type UserRole,
} from '../api/admin';

interface UseAdminUsersState {
  users: IAdminUser[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  isLoading: boolean;
  error: string | null;
}

export function useAdminUsers() {
  const fetchSeq = useRef(0);
  const [state, setState] = useState<UseAdminUsersState>({
    users: [],
    total: 0,
    page: 1,
    pageSize: 20,
    search: '',
    isLoading: false,
    error: null,
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // ─── Fetch list ────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(
    async (page = state.page, search = state.search) => {
      const requestSeq = fetchSeq.current + 1;
      fetchSeq.current = requestSeq;
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const res = await adminListUsersAPI({
          search: search || undefined,
          page,
          page_size: state.pageSize,
          sort: 'desc:created_at',
        });
        if (requestSeq !== fetchSeq.current) return;
        setState((prev) => ({
          ...prev,
          users: res.data,
          total: res.pagination.total,
          page: res.pagination.page,
          pageSize: res.pagination.page_size,
          search,
          isLoading: false,
        }));
      } catch (e: any) {
        if (requestSeq !== fetchSeq.current) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: e?.response?.data?.message ?? 'Failed to load users',
        }));
      }
    },
    [state.page, state.search, state.pageSize],
  );

  useEffect(() => {
    fetchUsers(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSearch = (search: string) => fetchUsers(1, search);
  const setPage = (page: number) => fetchUsers(page, state.search);

  // ─── Action helpers ────────────────────────────────────────────────────────

  const run = async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setActionLoading(true);
    setActionError(null);
    try {
      const result = await fn();
      return result;
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Action failed';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  const createUser = async (payload: IAdminCreateUserPayload) => {
    const result = await run(() => adminCreateUserAPI(payload));
    if (result) await fetchUsers(1, state.search);
    return result;
  };

  const updateUser = async (id: string, payload: IAdminUpdateUserPayload) => {
    const result = await run(() => adminUpdateUserAPI(id, payload));
    if (result) await fetchUsers(state.page, state.search);
    return result;
  };

  const deleteUser = async (id: string) => {
    const ok = await run(() => adminDeleteUserAPI(id));
    if (ok !== null) await fetchUsers(state.page, state.search);
    return ok !== null;
  };

  const resetPassword = async (id: string, newPassword: string) => {
    return run(() => adminResetPasswordAPI(id, newPassword));
  };

  const assignRole = async (id: string, role: UserRole) => {
    const result = await run(() => adminAssignRoleAPI(id, role));
    if (result) await fetchUsers(state.page, state.search);
    return result;
  };

  const setEnabled = async (id: string, enabled: boolean) => {
    const result = await run(() => (enabled ? adminEnableUserAPI(id) : adminDisableUserAPI(id)));
    if (result !== null) await fetchUsers(state.page, state.search);
    return result !== null;
  };

  return {
    // list state
    users: state.users,
    total: state.total,
    page: state.page,
    pageSize: state.pageSize,
    search: state.search,
    isLoading: state.isLoading,
    error: state.error,
    // actions state
    actionLoading,
    actionError,
    clearActionError: () => setActionError(null),
    // methods
    fetchUsers,
    setSearch,
    setPage,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
    assignRole,
    setEnabled,
  };
}
