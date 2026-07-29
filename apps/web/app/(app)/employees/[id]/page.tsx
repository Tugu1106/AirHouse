'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { EMPLOYEE_STATUSES, EMPLOYEE_POSITIONS } from '@airlink/core/types';
import { getItemType, type Employee } from '@airlink/core';
import { useData } from '@/components/DataProvider';
import { Dialog } from '@/components/ItemsView';
import { EmployeeForm } from '@/components/EmployeesView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { BranchSkeleton } from '@/components/Skeleton';
import {
  deleteEmployeeAction,
  createEmployeeLoginAction,
  resetEmployeeLoginAction,
} from '@/lib/actions';

const statusLabel = (s: string) => EMPLOYEE_STATUSES.find((x) => x.key === s)?.label ?? s;
const positionLabel = (p: string | null) =>
  EMPLOYEE_POSITIONS.find((x) => x.key === p)?.label ?? p ?? '—';

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
  newly_hired: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  on_leave: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  pregnancy_leave: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  fired: 'bg-red-500/15 text-red-300 ring-red-500/30',
  resigned: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

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
    <main className="mx-auto max-w-5xl space-y-5 px-6 py-6">
      <div className="flex items-center justify-between px-1">
        <Link href="/employees" className="text-sm text-slate-400 hover:text-brand">
          ← All employees
        </Link>
        <button onClick={() => setSettingsOpen(true)} className="btn-ghost">
          Settings
        </button>
      </div>

      {/* Profile hero */}
      <section className="panel p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand/20 text-xl font-bold text-brand-light ring-1 ring-brand/30">
            {initialsOf(emp.name)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-white">{emp.name}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {positionLabel(emp.position)} · {branchName}
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
          <Detail label="Branch" value={branchName} />
          <Detail label="Status" value={statusLabel(emp.status)} />
          <Detail label="Items held" value={String(assigned.length)} />
        </dl>
      </section>

      {/* Assigned items */}
      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold text-slate-200">
          Assigned items
          <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">
            {assigned.length}
          </span>
        </h2>

        {assigned.length === 0 ? (
          <div className="panel p-8 text-center text-sm text-slate-500">
            No items currently assigned.
          </div>
        ) : (
          <div className="grid gap-3">
            {assigned.map((i) => {
              const def = getItemType(i.type);
              const fields = def?.fields ?? [];
              return (
                <div key={i.id} className="panel p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-800 text-lg">
                      {ITEM_ICON[i.type] ?? '📦'}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-white">{def?.label ?? i.type}</div>
                      <div className="truncate text-xs text-slate-500">{branchName}</div>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                          ITEM_STATUS_STYLE[i.status] ?? ITEM_STATUS_STYLE.retired
                        }`}
                      >
                        {i.status.replace('_', ' ')}
                      </span>
                      <Link
                        href={`/item/${i.id}`}
                        className="text-xs font-medium text-slate-400 hover:text-brand"
                      >
                        History →
                      </Link>
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-800 pt-4 sm:grid-cols-3">
                    {fields.map((f) => {
                      const val = i.properties[f.key];
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
            <LoginAccess emp={emp} onChanged={refresh} />
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-slate-100">{value}</dd>
    </div>
  );
}

function LoginAccess({ emp, onChanged }: { emp: Employee; onChanged: () => Promise<void> }) {
  const [temp, setTemp] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(emp.email ?? '');
  const hasLogin = !!emp.user_id;

  const run = async (fn: () => Promise<{ ok: boolean; tempPassword?: string; error?: string }>) => {
    setBusy(true);
    setErr(null);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      setTemp(res.tempPassword ?? null);
      await onChanged();
    } else {
      setErr(res.error ?? 'Something went wrong');
    }
  };

  return (
    <div className="border-t border-slate-800 pt-4">
      <h3 className="text-sm font-semibold text-slate-300">Login access</h3>
      {temp ? (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-slate-500">
            Temporary password — share it; they set their own on first sign-in:
          </p>
          <div className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-brand-light">
            {temp}
          </div>
        </div>
      ) : hasLogin ? (
        <>
          <p className="mt-1 text-xs text-slate-500">
            Login active for <span className="text-slate-300">{emp.email}</span>. Reset if they forgot it.
          </p>
          <button
            onClick={() => run(() => resetEmployeeLoginAction(emp.id))}
            disabled={busy}
            className="btn-ghost mt-2 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Reset password'}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-500">
            Give this employee a read-only login. Enter their work email:
          </p>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="worker@airlink.mn"
            className="field mt-2"
          />
          <button
            onClick={() => run(() => createEmployeeLoginAction(emp.id, email.trim()))}
            disabled={busy || !email.trim()}
            className="btn-primary mt-2 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Create login'}
          </button>
        </>
      )}
      {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
    </div>
  );
}

function DangerZone({ hasItems, onDelete }: { hasItems: number; onDelete: () => Promise<boolean> }) {
  const [confirm, setConfirm] = useState(false);
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
        onClick={() => setConfirm(true)}
        className="mt-3 rounded-md border border-red-800 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/70"
      >
        Delete employee
      </button>

      {confirm && (
        <ConfirmDialog
          title="Delete employee?"
          message={
            hasItems > 0
              ? `This permanently deletes the employee; their ${hasItems} assigned item(s) will be unassigned. This cannot be undone.`
              : 'This permanently deletes the employee. This cannot be undone.'
          }
          confirmLabel="Yes, delete"
          danger
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            const ok = await onDelete();
            if (!ok) {
              setErr('Could not delete this employee.');
              setConfirm(false);
            }
          }}
        />
      )}
    </div>
  );
}
