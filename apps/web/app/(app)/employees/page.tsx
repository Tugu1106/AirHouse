'use client';

import { useData } from '@/components/DataProvider';
import { EmployeesView } from '@/components/EmployeesView';
import { ListSkeleton } from '@/components/Skeleton';

export default function EmployeesPage() {
  const { loading } = useData();
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      {loading ? <ListSkeleton /> : <EmployeesView />}
    </main>
  );
}
