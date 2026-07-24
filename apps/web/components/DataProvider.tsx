'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { DataBundle } from '@/lib/data';

const EMPTY: DataBundle = { items: [], branches: [], employees: [], userEmail: null };

interface DataContextValue extends DataBundle {
  /** True until the first client-side load finishes (drives skeletons). */
  loading: boolean;
  /** Re-fetch the whole bundle (call after any write). */
  refresh: () => Promise<void>;
  refreshing: boolean;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [bundle, setBundle] = useState<DataBundle>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/data', { cache: 'no-store' });
    if (res.ok) setBundle((await res.json()) as DataBundle);
  }, []);

  // Kick off the data load on mount — the shell renders immediately, this fills in.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await load();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return (
    <DataContext.Provider value={{ ...bundle, loading, refresh, refreshing }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within <DataProvider>');
  return ctx;
}
