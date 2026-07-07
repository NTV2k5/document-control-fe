'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  adminListRolesAPI,
  adminCreateRoleAPI,
  adminUpdateRoleAPI,
  adminDeleteRoleAPI,
} from 'reactjs-platform/utilities/api/admin';
import type { IRole, ICreateRolePayload, IUpdateRolePayload } from 'reactjs-platform/utilities/api/admin';

export function useAdminRoles() {
  const [roles, setRoles] = useState<IRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminListRolesAPI();
      setRoles(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to load roles');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const createRole = async (payload: ICreateRolePayload): Promise<boolean> => {
    setActionLoading(true);
    setActionError(null);
    try {
      const role = await adminCreateRoleAPI(payload);
      setRoles((prev) => [...prev, role]);
      return true;
    } catch (err) {
      setActionError((err as Error).message || 'Failed to create role');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const updateRole = async (id: string, payload: IUpdateRolePayload): Promise<boolean> => {
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await adminUpdateRoleAPI(id, payload);
      setRoles((prev) => prev.map((r) => (r.id === id ? updated : r)));
      return true;
    } catch (err) {
      setActionError((err as Error).message || 'Failed to update role');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const deleteRole = async (id: string): Promise<boolean> => {
    setActionLoading(true);
    setActionError(null);
    try {
      await adminDeleteRoleAPI(id);
      setRoles((prev) => prev.filter((r) => r.id !== id));
      return true;
    } catch (err) {
      setActionError((err as Error).message || 'Failed to delete role');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const clearActionError = () => setActionError(null);

  return {
    roles,
    isLoading,
    error,
    actionLoading,
    actionError,
    clearActionError,
    fetchRoles,
    createRole,
    updateRole,
    deleteRole,
  };
}
