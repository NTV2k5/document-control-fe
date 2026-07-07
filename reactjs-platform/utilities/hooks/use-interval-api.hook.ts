import { useCallback, useEffect, useRef } from 'react';

export interface UseIntervalApiOptions {
  /**
   * Interval in milliseconds (default: 60,000 = 60 seconds)
   */
  interval?: number;
  /**
   * Whether to start the interval immediately (default: true)
   */
  immediate?: boolean;
  /**
   * Whether the interval is enabled (default: true)
   */
  enabled?: boolean;
}

/**
 * Custom hook for calling APIs at regular intervals
 * @param callback - Function to call at each interval
 * @param options - Configuration options
 * @returns Object with control functions
 */
export function useIntervalApi(callback: () => void | Promise<void>, options: UseIntervalApiOptions = {}) {
  const {
    interval = 60000, // 60 seconds default
    immediate = true,
    enabled = true,
  } = options;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const startInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (enabled) {
      intervalRef.current = setInterval(async () => {
        try {
          await callbackRef.current();
        } catch (error) {
          console.error('Interval API call failed:', error);
        }
      }, interval);
    }
  }, [interval, enabled]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const restartInterval = useCallback(() => {
    stopInterval();
    startInterval();
  }, [startInterval, stopInterval]);

  // Start an interval on mount if immediate is true, or when enabled changes to true
  useEffect(() => {
    if (enabled) {
      if (immediate || intervalRef.current === null) {
        startInterval();
      }
    } else {
      stopInterval();
    }

    return () => {
      stopInterval();
    };
  }, [enabled, immediate, startInterval, stopInterval]);

  // Restart an interval when interval duration changes
  useEffect(() => {
    if (enabled && intervalRef.current !== null) {
      restartInterval();
    }
  }, [interval, restartInterval, enabled]);

  return {
    start: startInterval,
    stop: stopInterval,
    restart: restartInterval,
    isRunning: intervalRef.current !== null,
  };
}
