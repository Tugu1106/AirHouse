'use client';

import { useEffect, useMemo, useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { EMPLOYEE_STATUSES, EMPLOYEE_POSITIONS, type EmployeeStatus } from '@airlink/core/types';
import type { Employee } from '@airlink/core';
import { useData } from './DataProvider';
import { Dialog } from './ItemsView';
import { SubmitButton } from './SubmitButton';
import {
  createEmployeeAction,
  updateEmployeeAction,
  type ActionResult,
} from '@/lib/actions';

const STATUS_STYLES: Record<EmployeeStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  newly_hired: 'bg-blue-100 text-blue-700',
  on_leave: 'bg-amber-100 text-amber-700',
  pregnancy_leave: 'bg-pink-100 text-pink-700',
  fired: 'bg-red-100 text-red-700',
  resigned: 'bg-slate-200 text-slate-400',
};
const statusLabel = (s: string) => EMPLOYEE_STATUSES.find((x) => x.key === s)?.label ?? s;
const positionLabel = (p: string | null) =>
  EMPLOYEE_POSITIONS.find((x) => x.key === p)?.label ?? p ?? '—';

type Modal = { mode: 'add' } | { mode: 'edit'; emp: Employee } | null;

type LoginState = 'signed_in' | 'invited' | 'none';

function loginStateOf(
  emp: Employee,
  statuses: Record<string, { signedIn: boolean }> | null,
): LoginState {
  if (!emp.user_id) return 'none';
  if (statuses && statuses[emp.user_id]?.signedIn) return 'signed_in';
  return 'invited';
}

const LOGIN_BADGE: Record<LoginState, { label: string; cls: string }> = {
  signed_in: { label: 'Signed in', cls: 'bg-emerald-100 text-emerald-700' },
  invited: { label: 'Invited', cls: 'bg-amber-100 text-amber-700' },
  none: { label: 'No login', cls: 'bg-slate-200 text-slate-500' },
};

export function EmployeesView() {
  const { employees, branches, items, refresh } = useData();
  const [modal, setModal] = useState<Modal>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [branchId, setBranchId] = useState('');
  const [login, setLogin] = useState('');
  const [loginStatus, setLoginStatus] = useState<Record<string, { signedIn: boolean }> | null>(null);

  // Fetch sign-in status once (admin-only endpoint); badges fill in when it lands.
  useEffect(() => {
    let active = true;
    fetch('/api/login-status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => active && setLoginStatus(d))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? '—';
  const itemCount = (empId: string) => items.filter((i) => i.assigned_to === empId && !i.deleted_at).length;

  const counts = useMemo(() => {
    const c = { signed_in: 0, invited: 0, none: 0 };
    for (const e of employees) c[loginStateOf(e, loginStatus)]++;
    return c;
  }, [employees, loginStatus]);

  const visible = useMemo(() => {
    let rows = employees;
    if (status) rows = rows.filter((e) => e.status === status);
    if (branchId) rows = rows.filter((e) => e.branch_id === branchId);
    if (login) rows = rows.filter((e) => loginStateOf(e, loginStatus) === login);
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter((e) =>
        `${e.name} ${e.position ?? ''} ${e.phone ?? ''}`.toLowerCase().includes(term),
      );
    }
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, status, branchId, login, loginStatus, search]);

  const done = async () => {
    await refresh();
    setModal(null);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Employees</h1>
          <p className="text-sm text-slate-400">
            {employees.length} people ·{' '}
            <span className="text-emerald-400">{counts.signed_in} signed in</span> ·{' '}
            <span className="text-amber-400">{counts.invited} invited</span> ·{' '}
            <span className="text-slate-500">{counts.none} no login</span>
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + Add employee
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, position, phone…"
          className="w-56 rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-2 py-1.5 text-sm"
        />
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-2 py-1.5 text-sm">
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-2 py-1.5 text-sm">
          <option value="">All statuses</option>
          {EMPLOYEE_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select value={login} onChange={(e) => setLogin(e.target.value)} className="rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-2 py-1.5 text-sm">
          <option value="">Any login</option>
          <option value="signed_in">Signed in</option>
          <option value="invited">Invited (not yet)</option>
          <option value="none">No login</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-800/50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Position</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Login</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  No employees found.
                </td>
              </tr>
            )}
            {visible.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 font-medium text-slate-200">{e.name}</td>
                <td className="px-4 py-3 text-slate-400">{positionLabel(e.position)}</td>
                <td className="px-4 py-3 text-slate-400">{e.phone ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">{branchName(e.branch_id)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[e.status] ?? 'bg-slate-100 text-slate-400'}`}>
                    {statusLabel(e.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const b = LOGIN_BADGE[loginStateOf(e, loginStatus)];
                    return (
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${b.cls}`}>
                        {b.label}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-slate-400">{itemCount(e.id)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/employees/${e.id}`} className="text-slate-400 hover:text-brand">
                      View
                    </Link>
                    <button onClick={() => setModal({ mode: 'edit', emp: e })} className="text-slate-400 hover:text-brand">
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.mode === 'add' && (
        <Dialog title="Add employee" onClose={() => setModal(null)}>
          <EmployeeForm branches={branches} onDone={done} />
        </Dialog>
      )}
      {modal?.mode === 'edit' && (
        <Dialog title="Edit employee" onClose={() => setModal(null)}>
          <EmployeeForm branches={branches} emp={modal.emp} onDone={done} />
        </Dialog>
      )}
    </>
  );
}

export function EmployeeForm({
  branches,
  emp,
  defaultBranchId,
  onDone,
}: {
  branches: { id: string; name: string }[];
  emp?: Employee;
  defaultBranchId?: string | null;
  onDone: () => void;
}) {
  const action = emp ? updateEmployeeAction : createEmployeeAction;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  const [createdTemp, setCreatedTemp] = useState<string | null>(null);
  useEffect(() => {
    if (state?.ok) {
      if (state.tempPassword) setCreatedTemp(state.tempPassword);
      else onDone();
    }
  }, [state, onDone]);

  // Match the stored position to a known option by key OR label (case-insensitive),
  // so a value like "Developer" pre-selects the "developer" option. Unknown values
  // are shown as-is via an extra option.
  const currentPos = emp?.position ?? '';
  const matchedPos = EMPLOYEE_POSITIONS.find(
    (p) => p.key.toLowerCase() === currentPos.toLowerCase() || p.label.toLowerCase() === currentPos.toLowerCase(),
  );
  const positionValue = matchedPos?.key ?? currentPos;

  if (createdTemp) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-300">
          Employee added and their login is ready. Share this <b>temporary password</b> with them —
          they'll set their own on first sign-in:
        </p>
        <div className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-lg tracking-wide text-brand-light">
          {createdTemp}
        </div>
        <p className="text-xs text-slate-500">
          They sign in at this site with their work email + this password.
        </p>
        <div className="flex justify-end">
          <button onClick={onDone} className="btn-primary">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {emp && <input type="hidden" name="id" value={emp.id} />}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-300">Name *</label>
          <input name="name" required defaultValue={emp?.name ?? ''} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm" />
        </div>
        {!emp && (
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-300">
              Work email <span className="font-normal text-slate-500">(optional — enables their login)</span>
            </label>
            <input name="email" type="email" placeholder="worker@airlink.mn" className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm" />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-300">Phone</label>
          <input name="phone" defaultValue={emp?.phone ?? ''} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Position</label>
          <select name="position" defaultValue={positionValue} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 px-3 py-2 text-sm">
            <option value="">— none —</option>
            {EMPLOYEE_POSITIONS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
            {positionValue && !matchedPos && <option value={positionValue}>{positionValue}</option>}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Branch</label>
          <select name="branch_id" defaultValue={emp?.branch_id ?? defaultBranchId ?? ''} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm">
            <option value="">— none —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Status</label>
          <select name="status" defaultValue={emp?.status ?? 'active'} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm">
            {EMPLOYEE_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end">
        <SubmitButton>{emp ? 'Save changes' : 'Add employee'}</SubmitButton>
      </div>
    </form>
  );
}
