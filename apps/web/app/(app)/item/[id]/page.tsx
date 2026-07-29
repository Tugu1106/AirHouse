import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getItemWithRelations,
  listAuditForItem,
  listBranches,
  listEmployees,
  getItemType,
} from '@airlink/core';

export const dynamic = 'force-dynamic';

const fmt = (iso: string) => new Date(iso).toLocaleString();

export default async function ItemHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItemWithRelations(id);
  if (!item) notFound();

  const [audit, branches, employees] = await Promise.all([
    listAuditForItem(id),
    listBranches(),
    listEmployees(undefined, true), // include deleted so history resolves their name
  ]);

  const branchName = (bid: string | null) => branches.find((b) => b.id === bid)?.name ?? '—';
  const empName = (eid: string | null) => employees.find((e) => e.id === eid)?.name ?? '—';
  const def = getItemType(item.type);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-6">
      <Link href="/inventory" className="text-sm text-slate-400 hover:text-brand">
        ← Back to inventory
      </Link>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-xl font-semibold text-white">{def?.label ?? item.type}</h1>
        <p className="text-sm text-slate-400">
          {item.branch?.name} · {item.assignee?.name ?? 'Unassigned'} · {item.status}
          {item.deleted_at && <span className="ml-2 text-red-600">(deleted)</span>}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {def?.fields.map((f) => {
            const val = item.properties[f.key];
            const empty = val == null || val === '';
            if (f.hideWhenEmpty && empty) return null; // optional specs hide when blank
            return (
              <div key={f.key} className="flex justify-between border-b border-slate-800 py-1">
                <dt className="text-slate-400">{f.label}</dt>
                <dd className="font-medium text-slate-200">{empty ? '—' : String(val)}</dd>
              </div>
            );
          })}
        </dl>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">History</h2>
        <ol className="space-y-4">
          {audit.length === 0 && <p className="text-sm text-slate-400">No history yet.</p>}
          {audit.map((entry) => (
            <li key={entry.id} className="flex gap-3">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
              <div className="text-sm">
                <div className="font-medium text-slate-200">{describe(entry.action)}</div>
                {(entry.action === 'transfer' || entry.action === 'create') &&
                  (entry.from_employee_id || entry.to_employee_id) && (
                    <div className="text-slate-400">
                      {assigneeText(entry.from_employee_id, entry.to_employee_id, empName)}
                    </div>
                  )}
                {entry.action === 'transfer' && (entry.from_branch_id || entry.to_branch_id) && (
                  <div className="text-slate-400">
                    Branch: {branchName(entry.from_branch_id)} → {branchName(entry.to_branch_id)}.
                  </div>
                )}
                {entry.diff && entry.action === 'update' && (
                  <pre className="mt-1 overflow-x-auto rounded bg-slate-800/50 p-2 text-xs text-slate-400">
                    {JSON.stringify(entry.diff, null, 2)}
                  </pre>
                )}
                <div className="text-xs text-slate-400">{fmt(entry.created_at)}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}

function assigneeText(
  from: string | null,
  to: string | null,
  name: (id: string | null) => string,
): string {
  if (!from && to) return `Assigned to ${name(to)}`;
  if (from && !to) return `Unassigned from ${name(from)}`;
  if (from && to) return `Reassigned: ${name(from)} → ${name(to)}`;
  return '';
}

function describe(action: string): string {
  switch (action) {
    case 'create':
      return 'Item created';
    case 'update':
      return 'Item updated';
    case 'soft_delete':
      return 'Item deleted';
    case 'transfer':
      return 'Item transferred';
    default:
      return action;
  }
}
