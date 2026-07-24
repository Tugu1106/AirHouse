'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import type { DataBundle } from '@/lib/data';

interface DataContextValue extends DataBundle {
  /** Re-fetch the whole bundle from the server (call after any write). */
  refresh: () => Promise<void>;
  refreshing: boolean;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({
  initial,
  children,
}: {
  initial: DataBundle;
  children: React.ReactNode;
}) {
  const [bundle, setBundle] = useState<DataBundle>(initial);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      if (res.ok) setBundle((await res.json()) as DataBundle);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <DataContext.Provider value={{ ...bundle, refresh, refreshing }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within <DataProvider>');
  return ctx;
}
