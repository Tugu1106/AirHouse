'use client';

import { useEffect, useMemo, useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { EMPLOYEE_STATUSES, type EmployeeStatus } from '@airlink/core/types';
import type { Employee, ItemWithRelations } from '@airlink/core';
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

type Modal = { mode: 'add' } | { mode: 'edit'; emp: Employee } | { mode: 'detail'; emp: Employee } | null;

export function EmployeesView() {
  const { employees, branches, items, refresh } = useData();
  const [modal, setModal] = useState<Modal>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [branchId, setBranchId] = useState('');

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? '—';
  const itemCount = (empId: string) => items.filter((i) => i.assigned_to === empId && !i.deleted_at).length;

  const visible = useMemo(() => {
    let rows = employees;
    if (status) rows = rows.filter((e) => e.status === status);
    if (branchId) rows = rows.filter((e) => e.branch_id === branchId);
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter((e) =>
        `${e.name} ${e.position ?? ''} ${e.phone ?? ''}`.toLowerCase().includes(term),
      );
    }
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, status, branchId, search]);

  const done = async () => {
    await refresh();
    setModal(null);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Employees</h1>
          <p className="text-sm text-slate-400">{employees.length} people</p>
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
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No employees found.
                </td>
              </tr>
            )}
            {visible.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 font-medium text-slate-200">{e.name}</td>
                <td className="px-4 py-3 text-slate-400">{e.position ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">{e.phone ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">{branchName(e.branch_id)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[e.status] ?? 'bg-slate-100 text-slate-400'}`}>
                    {statusLabel(e.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">{itemCount(e.id)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setModal({ mode: 'detail', emp: e })} className="text-slate-400 hover:text-brand">
                      View
                    </button>
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
      {modal?.mode === 'detail' && (
        <Dialog title={modal.emp.name} onClose={() => setModal(null)}>
          <EmployeeDetail
            emp={modal.emp}
            branchName={branchName(modal.emp.branch_id)}
            items={items.filter((i) => i.assigned_to === modal.emp.id && !i.deleted_at)}
          />
        </Dialog>
      )}
    </>
  );
}

function EmployeeDetail({
  emp,
  branchName,
  items,
}: {
  emp: Employee;
  branchName: string;
  items: ItemWithRelations[];
}) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <Row label="Position" value={emp.position ?? '—'} />
        <Row label="Phone" value={emp.phone ?? '—'} />
        <Row label="Branch" value={branchName} />
        <Row label="Status" value={statusLabel(emp.status)} />
      </dl>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Assigned items ({items.length})</h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No items currently assigned.</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-md border border-slate-800">
            {items.map((i) => (
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
      </div>
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

function EmployeeForm({
  branches,
  emp,
  onDone,
}: {
  branches: { id: string; name: string }[];
  emp?: Employee;
  onDone: () => void;
}) {
  const action = emp ? updateEmployeeAction : createEmployeeAction;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {emp && <input type="hidden" name="id" value={emp.id} />}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-300">Name *</label>
          <input name="name" required defaultValue={emp?.name ?? ''} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Phone</label>
          <input name="phone" defaultValue={emp?.phone ?? ''} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Position</label>
          <input name="position" defaultValue={emp?.position ?? ''} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Branch</label>
          <select name="branch_id" defaultValue={emp?.branch_id ?? ''} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm">
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
