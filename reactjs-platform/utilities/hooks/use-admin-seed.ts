'use client';

import { useCallback, useEffect, useState } from 'react';
import { getDefaultSeedConfigAPI, runSeedRbacAPI, type ISeedRbacPayload, type ISeedReport } from '../api/admin';

export function useAdminSeed() {
  const [defaultConfig, setDefaultConfig] = useState<ISeedRbacPayload | null>(null);
  const [lastReport, setLastReport] = useState<ISeedReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchDefaultConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const config = await getDefaultSeedConfigAPI();
      setDefaultConfig(config);
    } catch (err) {
      setError((err as Error).message || 'Failed to load seed configuration');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDefaultConfig();
  }, [fetchDefaultConfig]);

  const runSeed = async (payload?: ISeedRbacPayload) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const report = await runSeedRbacAPI(payload);
      setLastReport(report);
      return report;
    } catch (err) {
      setActionError((err as Error).message || 'Failed to run seed');
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  return {
    defaultConfig,
    lastReport,
    isLoading,
    actionLoading,
    error,
    actionError,
    refresh: fetchDefaultConfig,
    runSeed,
  };
}
