type TVariablePerformanceDetails = Record<string, unknown>;

export const isVariablePerformanceDebugEnabled = () =>
  import.meta.env.DEV && typeof window !== 'undefined' && window.location.pathname.includes('/variables');

export const shouldLogVariablePerformanceCycle = (cycle: number) => cycle <= 5 || cycle % 25 === 0;

export const logVariablePerformance = (label: string, details: TVariablePerformanceDetails = {}) => {
  if (!isVariablePerformanceDebugEnabled()) return;

  console.info(`[variables-perf] ${label}`, details);
};

export const measureVariablePerformance = <T>(
  label: string,
  operation: () => T,
  details: TVariablePerformanceDetails = {},
  minimumDurationMs = 8,
): T => {
  if (!isVariablePerformanceDebugEnabled() || typeof performance === 'undefined') {
    return operation();
  }

  const startedAt = performance.now();
  const result = operation();
  const durationMs = performance.now() - startedAt;

  if (durationMs >= minimumDurationMs) {
    logVariablePerformance(label, {
      ...details,
      duration_ms: Number(durationMs.toFixed(2)),
    });
  }

  return result;
};
