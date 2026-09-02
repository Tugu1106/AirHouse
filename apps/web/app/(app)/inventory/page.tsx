'use client';

import { useState } from 'react';
import { useData } from '@/components/DataProvider';
import { ItemsView } from '@/components/ItemsView';
import { AdminBar } from '@/components/AdminBar';
import { ExportButton } from '@/components/ExportButton';
import { ListSkeleton } from '@/components/Skeleton';

export default function InventoryPage() {
  const { items, branches, loading } = useData();
  const [branchId, setBranchId] = useState<string | undefined>(undefined);

  const live = items.filter((i) => !i.deleted_at);
  const countFor = (id?: string) => (id ? live.filter((i) => i.branch_id === id).length : live.length);

  if (loading) {
    return (
      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <ListSkeleton />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-5 px-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Inventory</h1>
          <p className="text-sm text-slate-400">
            {live.length} live items across {branches.length} branches
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton />
          <AdminBar />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={!branchId} onClick={() => setBranchId(undefined)} label="All branches" count={countFor()} />
        {branches.map((b) => (
          <Chip
            key={b.id}
            active={branchId === b.id}
            onClick={() => setBranchId(b.id)}
            label={b.name}
            count={countFor(b.id)}
          />
        ))}
      </div>

      <ItemsView scopeBranchId={branchId} />
    </main>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-40 items-center justify-between gap-2 rounded-md border px-4 py-2.5 text-sm ${
        active
          ? 'border-brand bg-brand/15 font-medium text-white'
          : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-white'
      }`}
    >
      <span className="truncate">{label}</span>
      <span className={active ? 'text-brand-light' : 'text-slate-500'}>{count}</span>
    </button>
  );
}
