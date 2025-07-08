"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface UseOptimizedPollingOptions {
  interval: number;
  enabled?: boolean;
  immediate?: boolean;
  compareFunction?: (prev: any, next: any) => boolean;
}

export function useOptimizedPolling<T>(
  fetchFunction: () => Promise<T>,
  {
    interval,
    enabled = true,
    immediate = true,
    compareFunction,
  }: UseOptimizedPollingOptions
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchFunctionRef = useRef(fetchFunction);
  const previousDataRef = useRef<T | null>(null);

  // Update fetch function ref when it changes
  useEffect(() => {
    fetchFunctionRef.current = fetchFunction;
  }, [fetchFunction]);

  const poll = useCallback(async () => {
    try {
      setError(null);
      const newData = await fetchFunctionRef.current();

      // Only update state if data has actually changed
      const hasChanged = compareFunction
        ? !compareFunction(previousDataRef.current, newData)
        : JSON.stringify(previousDataRef.current) !== JSON.stringify(newData);

      if (hasChanged || previousDataRef.current === null) {
        previousDataRef.current = newData;
        setData(newData);
        setLastUpdated(new Date());
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  }, [compareFunction]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;

    if (immediate) {
      poll();
    }

    intervalRef.current = setInterval(poll, interval);
  }, [interval, immediate, poll]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return stopPolling;
  }, [enabled, startPolling, stopPolling]);

  const forceRefresh = useCallback(async () => {
    previousDataRef.current = null; // Force update on next poll
    await poll();
  }, [poll]);

  return {
    data,
    setData,
    loading,
    error,
    lastUpdated,
    isPolling: intervalRef.current !== null,
    forceRefresh,
    startPolling,
    stopPolling,
  };
}
