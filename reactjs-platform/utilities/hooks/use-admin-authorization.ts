'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  adminGetAuthorizationOverviewAPI,
  adminListOrganizationUnitsAPI,
  adminCreateOrganizationUnitAPI,
  adminUpdateOrganizationUnitAPI,
  adminDeleteOrganizationUnitAPI,
  adminListPermissionsAPI,
  adminCreatePermissionAPI,
  adminUpdatePermissionAPI,
  adminDeletePermissionAPI,
  type IAuthorizationOverview,
  type IOrganizationUnit,
  type ICreateOrganizationUnitPayload,
  type IUpdateOrganizationUnitPayload,
  type IPermission,
  type ICreatePermissionPayload,
  type IUpdatePermissionPayload,
} from '../api/admin';

interface UseAdminAuthorizationOptions {
  includeOverview?: boolean;
  includeOrganizationUnits?: boolean;
  includePermissions?: boolean;
}

const getAdminErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return fallback;
};

const collectRejectedMessages = (results: PromiseSettledResult<unknown>[]) => {
  return [
    ...new Set(
      results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => getAdminErrorMessage(result.reason, 'Failed to load authorization data')),
    ),
  ];
};

export function useAdminAuthorization({
  includeOverview = true,
  includeOrganizationUnits = true,
  includePermissions = true,
}: UseAdminAuthorizationOptions = {}) {
  const [overview, setOverview] = useState<IAuthorizationOverview | null>(null);
  const [organizationUnits, setOrganizationUnits] = useState<IOrganizationUnit[]>([]);
  const [permissions, setPermissions] = useState<IPermission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchAuthorizationData = useCallback(async () => {
    if (!includeOverview && !includeOrganizationUnits && !includePermissions) {
      setOverview(null);
      setOrganizationUnits([]);
      setPermissions([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [overviewResult, unitsResult, permissionsResult] = await Promise.allSettled([
        includeOverview ? adminGetAuthorizationOverviewAPI() : Promise.resolve(null),
        includeOrganizationUnits ? adminListOrganizationUnitsAPI() : Promise.resolve([]),
        includePermissions ? adminListPermissionsAPI() : Promise.resolve([]),
      ]);

      if (overviewResult.status === 'fulfilled') setOverview(overviewResult.value);
      else setOverview(null);

      if (unitsResult.status === 'fulfilled') setOrganizationUnits(unitsResult.value);
      else setOrganizationUnits([]);

      if (permissionsResult.status === 'fulfilled') setPermissions(permissionsResult.value);
      else setPermissions([]);

      const messages = collectRejectedMessages([overviewResult, unitsResult, permissionsResult]);
      if (messages.length) {
        setError(messages.join(' · '));
      }
    } catch (err) {
      setError(getAdminErrorMessage(err, 'Failed to load authorization data'));
    } finally {
      setIsLoading(false);
    }
  }, [includeOverview, includeOrganizationUnits, includePermissions]);

  useEffect(() => {
    fetchAuthorizationData();
  }, [fetchAuthorizationData]);

  const run = useCallback(async <T>(callback: () => Promise<T>) => {
    setActionLoading(true);
    setActionError(null);
    try {
      return await callback();
    } catch (err) {
      setActionError(getAdminErrorMessage(err, 'Action failed'));
      return null;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const createOrganizationUnit = async (payload: ICreateOrganizationUnitPayload) => {
    const result = await run(() => adminCreateOrganizationUnitAPI(payload));
    if (result) {
      setOrganizationUnits((prev) =>
        [...prev, result].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
      );
      setOverview((prev) => (prev ? { ...prev, units: prev.units + 1 } : prev));
      return true;
    }
    return false;
  };

  const updateOrganizationUnit = async (id: string, payload: IUpdateOrganizationUnitPayload) => {
    const result = await run(() => adminUpdateOrganizationUnitAPI(id, payload));
    if (result) {
      setOrganizationUnits((prev) => prev.map((unit) => (unit.id === id ? result : unit)));
      return true;
    }
    return false;
  };

  const deleteOrganizationUnit = async (id: string) => {
    const ok = await run(() => adminDeleteOrganizationUnitAPI(id));
    if (ok !== null) {
      setOrganizationUnits((prev) => prev.filter((unit) => unit.id !== id));
      setOverview((prev) => (prev ? { ...prev, units: Math.max(prev.units - 1, 0) } : prev));
      return true;
    }
    return false;
  };

  const createPermission = async (payload: ICreatePermissionPayload) => {
    const result = await run(() => adminCreatePermissionAPI(payload));
    if (result) {
      setPermissions((prev) => [...prev, result].sort((a, b) => a.code.localeCompare(b.code)));
      setOverview((prev) => (prev ? { ...prev, permissions: prev.permissions + 1 } : prev));
      return true;
    }
    return false;
  };

  const updatePermission = async (id: string, payload: IUpdatePermissionPayload) => {
    const result = await run(() => adminUpdatePermissionAPI(id, payload));
    if (result) {
      setPermissions((prev) => prev.map((permission) => (permission.id === id ? result : permission)));
      return true;
    }
    return false;
  };

  const deletePermission = async (id: string) => {
    const ok = await run(() => adminDeletePermissionAPI(id));
    if (ok !== null) {
      setPermissions((prev) => prev.filter((permission) => permission.id !== id));
      setOverview((prev) => (prev ? { ...prev, permissions: Math.max(prev.permissions - 1, 0) } : prev));
      return true;
    }
    return false;
  };

  return {
    overview,
    organizationUnits,
    permissions,
    isLoading,
    error,
    actionLoading,
    actionError,
    clearActionError: () => setActionError(null),
    refresh: fetchAuthorizationData,
    createOrganizationUnit,
    updateOrganizationUnit,
    deleteOrganizationUnit,
    createPermission,
    updatePermission,
    deletePermission,
  };
}
