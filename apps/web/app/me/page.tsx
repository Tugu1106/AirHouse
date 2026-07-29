import { redirect } from 'next/navigation';
import {
  listItems,
  listBranches,
  getItemType,
  EMPLOYEE_STATUSES,
  EMPLOYEE_POSITIONS,
} from '@airlink/core';
import { getRole } from '@/lib/auth';
import { signOutAction } from '@/lib/actions';

export const dynamic = 'force-dynamic';

const statusLabel = (s: string) => EMPLOYEE_STATUSES.find((x) => x.key === s)?.label ?? s;
const positionLabel = (p: string | null) =>
  EMPLOYEE_POSITIONS.find((x) => x.key === p)?.label ?? p ?? '—';

export default async function MePage() {
  const r = await getRole();
  if (r.role === 'admin') redirect('/map');

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen">
      <header className="border-b border-slate-800/80 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-3">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-xs font-bold text-white">
            A
          </span>
          <span className="text-base font-semibold text-white">Airlink · My profile</span>
          <form action={signOutAction} className="ml-auto">
            <button className="btn-ghost">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-6">{children}</main>
    </div>
  );

  if (r.role !== 'worker') {
    return shell(
      <div className="panel p-6 text-center">
        <p className="font-medium text-slate-200">No profile linked to this account</p>
        <p className="mt-1 text-sm text-slate-500">Please contact your administrator.</p>
      </div>,
    );
  }

  const emp = r.employee;
  const [items, branches] = await Promise.all([listItems({ assignedTo: emp.id }), listBranches()]);
  const branchName = branches.find((b) => b.id === emp.branch_id)?.name ?? '—';

  return shell(
    <>
      <div>
        <h1 className="text-2xl font-semibold text-white">{emp.name}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {positionLabel(emp.position)} · {branchName}
        </p>
      </div>

      <section className="panel p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">My details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Row label="Phone" value={emp.phone ?? '—'} />
          <Row label="Position" value={positionLabel(emp.position)} />
          <Row label="Branch" value={branchName} />
          <Row label="Status" value={statusLabel(emp.status)} />
          <Row label="Email" value={emp.email ?? '—'} />
        </dl>
      </section>

      <section className="panel p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">My items ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No items assigned to you.</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-md border border-slate-800">
            {items.map((i) => {
              const def = getItemType(i.type);
              const detail = [i.properties.serial, i.properties.system_name, i.properties.model]
                .filter(Boolean)
                .join(' · ');
              return (
                <li key={i.id} className="px-3 py-2 text-sm">
                  <span className="font-medium text-white">{def?.label ?? i.type}</span>
                  {detail && <span className="text-slate-400"> · {detail}</span>}
                  <span className="ml-2 text-xs text-slate-500">({i.status})</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>,
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
