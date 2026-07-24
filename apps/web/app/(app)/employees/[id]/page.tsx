'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { EMPLOYEE_STATUSES, EMPLOYEE_POSITIONS } from '@airlink/core/types';
import { useData } from '@/components/DataProvider';
import { Dialog } from '@/components/ItemsView';
import { EmployeeForm } from '@/components/EmployeesView';
import { BranchSkeleton } from '@/components/Skeleton';
import { deleteEmployeeAction } from '@/lib/actions';

const statusLabel = (s: string) => EMPLOYEE_STATUSES.find((x) => x.key === s)?.label ?? s;
const positionLabel = (p: string | null) =>
  EMPLOYEE_POSITIONS.find((x) => x.key === p)?.label ?? p ?? '—';

export default function EmployeePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { employees, branches, items, refresh, loading } = useData();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const id = params.id;
  const emp = employees.find((e) => e.id === id);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-6">
        <BranchSkeleton />
      </main>
    );
  }

  if (!emp) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-slate-400">Employee not found.</p>
      </main>
    );
  }

  const branchName = branches.find((b) => b.id === emp.branch_id)?.name ?? '—';
  const assigned = items.filter((i) => i.assigned_to === id && !i.deleted_at);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-brand-light">Employee</div>
          <h1 className="text-2xl font-semibold text-white">{emp.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {positionLabel(emp.position)} · {branchName}
          </p>
        </div>
        <button onClick={() => setSettingsOpen(true)} className="btn-ghost">
          Settings
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Items held" value={assigned.length} />
        <StatTile label="Branch" value={branchName} />
        <StatTile label="Position" value={positionLabel(emp.position)} />
        <StatTile label="Status" value={statusLabel(emp.status)} />
      </div>

      <section className="panel p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Profile</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Row label="Phone" value={emp.phone ?? '—'} />
          <Row label="Position" value={positionLabel(emp.position)} />
          <Row label="Branch" value={branchName} />
          <Row label="Status" value={statusLabel(emp.status)} />
        </dl>
      </section>

      <section className="panel p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Assigned items ({assigned.length})</h2>
        {assigned.length === 0 ? (
          <p className="text-sm text-slate-500">No items currently assigned.</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-md border border-slate-800">
            {assigned.map((i) => (
              <li key={i.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-slate-300">
                  {i.type} · {[i.properties.serial, i.properties.model].filter(Boolean).join(' ') || '—'}
                </span>
                <Link href={`/item/${i.id}`} className="text-slate-400 hover:text-brand">
                  history →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {settingsOpen && (
        <Dialog title="Edit employee" onClose={() => setSettingsOpen(false)}>
          <div className="space-y-6">
            <EmployeeForm
              branches={branches}
              emp={emp}
              onDone={async () => {
                await refresh();
                setSettingsOpen(false);
              }}
            />
            <DangerZone
              hasItems={assigned.length}
              onDelete={async () => {
                const res = await deleteEmployeeAction(id);
                if (res.ok) {
                  await refresh();
                  router.push('/employees');
                }
                return res.ok;
              }}
            />
          </div>
        </Dialog>
      )}
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="panel p-4">
      <div className="truncate text-2xl font-bold leading-none text-white">{value}</div>
      <div className="mt-2 text-xs uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-800 py-1">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-200">{value}</dd>
    </div>
  );
}

function DangerZone({ hasItems, onDelete }: { hasItems: number; onDelete: () => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="border-t border-slate-800 pt-4">
      <h3 className="text-sm font-semibold text-red-400">Danger zone</h3>
      <p className="mt-1 text-xs text-slate-500">
        Permanently delete this employee.
        {hasItems > 0 && ` Their ${hasItems} assigned item(s) will be unassigned first.`} This cannot
        be undone.
      </p>
      {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
      <button
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const ok = await onDelete();
          if (!ok) {
            setErr('Could not delete this employee.');
            setBusy(false);
          }
        }}
        disabled={busy}
        className="mt-3 rounded-md border border-red-800 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/70 disabled:opacity-50"
      >
        {busy ? 'Deleting…' : 'Delete employee'}
      </button>
    </div>
  );
}
