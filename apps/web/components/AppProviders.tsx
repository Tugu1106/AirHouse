'use client';

import { DataProvider } from './DataProvider';
import { AppShell } from './AppShell';

export function AppProviders({
  isMaster,
  children,
}: {
  isMaster: boolean;
  children: React.ReactNode;
}) {
  return (
    <DataProvider>
      <AppShell isMaster={isMaster}>{children}</AppShell>
    </DataProvider>
  );
}
