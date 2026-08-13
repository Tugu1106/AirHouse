import Link from 'next/link';
import { listActivity, listEmployees, listBranches, type ActivityEntry } from '@airlink/core';

export const dynamic = 'force-dynamic';

const fmt = (iso: string) => new Date(iso).toLocaleString();

const ACTION_LABEL: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  transfer: 'Transferred',
  soft_delete: 'Deleted',
};
const ACTION_STYLE: Record<string, string> = {
  create: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  update: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  transfer: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  soft_delete: 'bg-red-500/15 text-red-300 ring-red-500/30',
};

export default async function ActivityPage() {
  const [activity, employees, branches] = await Promise.all([
    listActivity(300),
    listEmployees(undefined, true), // include deleted so names still resolve
    listBranches(),
  ]);

  const empName = (id: string | null) => (id ? (employees.find((e) => e.id === id)?.name ?? '—') : '—');
  const brName = (id: string | null) => (id ? (branches.find((b) => b.id === id)?.name ?? '—') : '—');

  const detail = (e: ActivityEntry): string => {
    const parts: string[] = [];
    if (e.action === 'transfer' || e.action === 'create') {
      if (!e.from_employee_id && e.to_employee_id) parts.push(`Assigned to ${empName(e.to_employee_id)}`);
      else if (e.from_employee_id && !e.to_employee_id) parts.push(`Unassigned from ${empName(e.from_employee_id)}`);
      else if (e.from_employee_id && e.to_employee_id)
        parts.push(`${empName(e.from_employee_id)} → ${empName(e.to_employee_id)}`);
    }
    if (e.action === 'transfer' && (e.from_branch_id || e.to_branch_id)) {
      parts.push(`Branch: ${brName(e.from_branch_id)} → ${brName(e.to_branch_id)}`);
    }
    return parts.join(' · ');
  };

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-6 py-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Activity log</h1>
        <p className="text-sm text-slate-400">
          Every change and who made it — read-only. Showing the {activity.length} most recent actions.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-800/50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {activity.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No activity yet.
                </td>
              </tr>
            )}
            {activity.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-400">{fmt(e.created_at)}</td>
                <td className="px-4 py-3 font-medium text-slate-200">{e.actor_email ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                      ACTION_STYLE[e.action] ?? 'bg-slate-500/15 text-slate-300 ring-slate-500/30'
                    }`}
                  >
                    {ACTION_LABEL[e.action] ?? e.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {e.item_id ? (
                    <Link href={`/item/${e.item_id}`} className="hover:text-brand">
                      {e.item_type ?? 'item'}
                      {e.item_name ? ` · ${e.item_name}` : ''}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400">{detail(e) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
