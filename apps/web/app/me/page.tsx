import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  listItems,
  listBranches,
  getItemType,
  EMPLOYEE_STATUSES,
  EMPLOYEE_POSITIONS,
} from '@airlink/core';
import { getRole } from '@/lib/auth';
import { signOutAction } from '@/lib/actions';
import { RegisterPc } from '@/components/RegisterPc';

export const dynamic = 'force-dynamic';

const statusLabel = (s: string) => EMPLOYEE_STATUSES.find((x) => x.key === s)?.label ?? s;
const positionLabel = (p: string | null) =>
  EMPLOYEE_POSITIONS.find((x) => x.key === p)?.label ?? p ?? '—';

// Emoji per item type — quick visual recognition on each card.
const ITEM_ICON: Record<string, string> = {
  desktop: '🖥️',
  laptop: '💻',
  monitor: '🖥️',
  mouse: '🖱️',
  keyboard: '⌨️',
  printer: '🖨️',
  cable: '🔌',
  lan_switch: '🌐',
};

const ITEM_STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  in_repair: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  retired: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
  lost: 'bg-red-500/15 text-red-300 ring-red-500/30',
};

const EMP_STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  trial: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  pregnancy_leave: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  fired: 'bg-red-500/15 text-red-300 ring-red-500/30',
};

export default async function MePage() {
  const r = await getRole();
  if (r.role === 'none') redirect('/login');
  if (r.user.must_reset) redirect('/set-password');
  if (r.role === 'admin') redirect('/map');

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon-32.png" alt="AIRHOUSE" className="h-9 w-9" />
          <span className="text-base font-semibold text-white">My profile</span>
          <Link href="/account" className="btn-ghost ml-auto">
            Change password
          </Link>
          <form action={signOutAction}>
            <button className="btn-ghost">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-6 py-6">{children}</main>
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
  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? '—';
  const homeBranch = branchName(emp.branch_id);
  const initials =
    emp.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?';

  return shell(
    <>
      {/* Profile hero */}
      <section className="panel p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand/20 text-xl font-bold text-brand-light ring-1 ring-brand/30">
            {initials}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-white">{emp.name}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {positionLabel(emp.position)} · {homeBranch}
            </p>
          </div>
          <span
            className={`ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-medium ring-1 ${
              EMP_STATUS_STYLE[emp.status] ?? EMP_STATUS_STYLE.active
            }`}
          >
            {statusLabel(emp.status)}
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-800 pt-5 sm:grid-cols-3">
          <Detail label="Email" value={emp.email ?? '—'} />
          <Detail label="Phone" value={emp.phone ?? '—'} />
          <Detail label="Position" value={positionLabel(emp.position)} />
          <Detail label="Sector" value={emp.sector ?? '—'} />
          <Detail label="Branch" value={homeBranch} />
          <Detail label="Status" value={statusLabel(emp.status)} />
        </dl>
      </section>

      {/* Register a device */}
      <section className="panel p-5">
        <h2 className="text-sm font-semibold text-slate-200">Add your computer</h2>
        <p className="mt-1 text-xs text-slate-500">
          Register the machine you’re using so IT can track it. Pick the one that matches your device.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-slate-400">On Windows:</p>
            <RegisterPc platform="windows" />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-slate-400">On a Mac (iMac / MacBook):</p>
            <RegisterPc platform="mac" />
          </div>
        </div>
      </section>

      {/* Assigned items */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-slate-200">
            My items
            <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">
              {items.length}
            </span>
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="panel p-8 text-center text-sm text-slate-500">
            No items are assigned to you.
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => {
              const def = getItemType(item.type);
              const fields = def?.fields ?? [];
              return (
                <div key={item.id} className="panel p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-800 text-lg">
                      {ITEM_ICON[item.type] ?? '📦'}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-white">{def?.label ?? item.type}</div>
                      <div className="truncate text-xs text-slate-500">
                        {branchName(item.branch_id)}
                      </div>
                    </div>
                    <span
                      className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                        ITEM_STATUS_STYLE[item.status] ?? ITEM_STATUS_STYLE.retired
                      }`}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-800 pt-4 sm:grid-cols-3">
                    {fields.map((f) => {
                      const val = item.properties[f.key];
                      const empty = val == null || val === '';
                      if (f.hideWhenEmpty && empty) return null;
                      return <Detail key={f.key} label={f.label} value={empty ? '—' : String(val)} />;
                    })}
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>,
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-slate-100">{value}</dd>
    </div>
  );
}
