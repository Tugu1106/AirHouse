'use client';

import { DataProvider } from './DataProvider';
import { AppShell } from './AppShell';
import type { DataBundle } from '@/lib/data';

export function AppProviders({
  initial,
  children,
}: {
  initial: DataBundle;
  children: React.ReactNode;
}) {
  return (
    <DataProvider initial={initial}>
      <AppShell>{children}</AppShell>
    </DataProvider>
  );
}
