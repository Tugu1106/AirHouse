'use client';

import { DataProvider } from './DataProvider';
import { AppShell } from './AppShell';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <AppShell>{children}</AppShell>
    </DataProvider>
  );
}
