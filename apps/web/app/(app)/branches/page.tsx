'use client';

import Link from 'next/link';
import { useData } from '@/components/DataProvider';
import { AdminBar } from '@/components/AdminBar';
import { branchStats } from '@/lib/branchStats';

export default function BranchesPage() {
  const { branches, items, employees } = useData();

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Branches</h1>
          <p className="text-sm text-slate-400">{branches.length} branches</p>
        </div>
        <AdminBar />
      </div>

      {branches.length === 0 ? (
        <p className="text-sm text-slate-500">No branches yet. Use “+ Branch” to add one.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...branches]
            .sort((a, b) => Number(b.is_hq) - Number(a.is_hq) || a.name.localeCompare(b.name))
            .map((b) => {
              const { staff, breakdown } = branchStats(b.id, items, employees);
              const itemCount = breakdown.reduce((s, r) => s + r.count, 0);
              return (
                <Link
                  key={b.id}
                  href={`/branch/${b.id}`}
                  className={`panel p-4 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_0_28px_-10px_rgba(14,165,233,0.85)] ${
                    b.is_hq ? 'border-brand' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-white">{b.name}</span>
                    {b.is_hq && (
                      <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-brand-light">
                        ★ CENTRAL
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-end gap-5">
                    <div>
                      <span className="text-2xl font-bold leading-none text-brand-light">{itemCount}</span>
                      <span className="ml-1 text-xs text-slate-400">items</span>
                    </div>
                    <div>
                      <span className="text-2xl font-bold leading-none text-white">{staff}</span>
                      <span className="ml-1 text-xs text-slate-400">staff</span>
                    </div>
                  </div>
                </Link>
              );
            })}
        </div>
      )}
    </main>
  );
}
