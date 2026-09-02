'use client';

import { useEffect, useMemo, useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import {
  EMPLOYEE_STATUSES,
  EMPLOYEE_POSITIONS,
  DEFAULT_POSITION,
  type EmployeeStatus,
} from '@airlink/core/types';
import type { Employee } from '@airlink/core';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useData } from './DataProvider';
import { Dialog } from './ItemsView';
import { Select } from './Select';
import { SubmitButton } from './SubmitButton';
import {
  createEmployeeAction,
  updateEmployeeAction,
  reorderEmployeesAction,
  type ActionResult,
} from '@/lib/actions';

// Keep a dragged row moving only up/down (no sideways drift → no horizontal scroll).
const restrictVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

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
  const [sort, setSort] = useState<'name' | 'custom'>('name');
  const [loginStatus, setLoginStatus] = useState<Record<string, { signedIn: boolean }> | null>(null);

  useEffect(() => {
    if (localStorage.getItem('employees_sort') === 'custom') setSort('custom');
  }, []);
  useEffect(() => {
    localStorage.setItem('employees_sort', sort);
  }, [sort]);

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
    return [...rows].sort((a, b) => {
      if (sort === 'custom') {
        // Group by branch, then each branch's manual order (nulls last).
        const ba = branchName(a.branch_id);
        const bb = branchName(b.branch_id);
        if (ba !== bb) return ba.localeCompare(bb);
        return (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER);
      }
      return a.name.localeCompare(b.name);
    });
  }, [employees, status, branchId, login, loginStatus, search, sort, branches]);

  const done = async () => {
    await refresh();
    setModal(null);
  };

  // --- Custom (manual) order via drag-and-drop (per branch; no other filters) --
  const dndEnabled = sort === 'custom' && !status && !login && !search.trim();
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const orderedRows = useMemo(() => {
    if (dndEnabled && dragOrder) {
      const byId = new Map(visible.map((v) => [v.id, v]));
      return dragOrder.map((id) => byId.get(id)).filter(Boolean) as typeof visible;
    }
    return visible;
  }, [visible, dragOrder, dndEnabled]);

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = orderedRows.map((r) => r.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(ids, from, to);
    setDragOrder(next);

    // sort_order is per-branch: persist each branch's sub-order from the arrangement.
    const rowById = new Map(orderedRows.map((r) => [r.id, r]));
    const byBranch = new Map<string, string[]>();
    for (const id of next) {
      const r = rowById.get(id);
      if (!r) continue;
      const key = r.branch_id ?? 'none';
      byBranch.set(key, [...(byBranch.get(key) ?? []), id]);
    }
    for (const arr of byBranch.values()) await reorderEmployeesAction(arr);
    await refresh();
    setDragOrder(null);
  };

  // The <td> cells for one employee row — shared by plain and draggable rows.
  const renderCells = (e: Employee) => (
    <>
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
          return <span className={`rounded px-2 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>;
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
    </>
  );

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
        <Select
          value={branchId}
          onChange={setBranchId}
          className="w-40"
          options={[
            { value: '', label: 'All branches' },
            ...branches.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
        <Select
          value={status}
          onChange={setStatus}
          className="w-40"
          options={[
            { value: '', label: 'All statuses' },
            ...EMPLOYEE_STATUSES.map((s) => ({ value: s.key, label: s.label })),
          ]}
        />
        <Select
          value={login}
          onChange={setLogin}
          className="w-40"
          options={[
            { value: '', label: 'Any login' },
            { value: 'signed_in', label: 'Signed in' },
            { value: 'invited', label: 'Invited (not yet)' },
            { value: 'none', label: 'No login' },
          ]}
        />
        <Select
          value={sort}
          onChange={(v) => setSort(v as 'name' | 'custom')}
          className="w-40"
          options={[
            { value: 'name', label: 'Name A–Z' },
            { value: 'custom', label: 'Custom (drag)' },
          ]}
        />
      </div>

      {sort === 'custom' && !dndEnabled && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Showing your saved custom order. Clear the filters/search to drag employees into a new order.
        </div>
      )}

      <div className="no-scrollbar overflow-x-auto rounded-lg border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-800/50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {dndEnabled && <th className="w-8 px-2 py-3"></th>}
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

          {dndEnabled ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
              modifiers={[restrictVerticalAxis]}
              autoScroll={false}
            >
              <SortableContext items={orderedRows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <tbody className="divide-y divide-slate-800">
                  {orderedRows.map((e) => (
                    <SortableEmpRow key={e.id} id={e.id}>
                      {renderCells(e)}
                    </SortableEmpRow>
                  ))}
                </tbody>
              </SortableContext>
            </DndContext>
          ) : (
            <tbody className="divide-y divide-slate-800">
              {orderedRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    No employees found.
                  </td>
                </tr>
              )}
              {orderedRows.map((e) => (
                <tr key={e.id}>{renderCells(e)}</tr>
              ))}
            </tbody>
          )}
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

// A draggable employee row (Custom sort). The grip cell carries the listeners.
function SortableEmpRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <tr ref={setNodeRef} style={style} className="bg-slate-900">
      <td className="w-8 px-2 py-3">
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="cursor-grab touch-none text-slate-500 transition hover:text-slate-200 active:cursor-grabbing"
        >
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden>
            <circle cx="7" cy="4" r="1.4" />
            <circle cx="13" cy="4" r="1.4" />
            <circle cx="7" cy="10" r="1.4" />
            <circle cx="13" cy="10" r="1.4" />
            <circle cx="7" cy="16" r="1.4" />
            <circle cx="13" cy="16" r="1.4" />
          </svg>
        </button>
      </td>
      {children}
    </tr>
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
  const { employees } = useData();
  const action = emp ? updateEmployeeAction : createEmployeeAction;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  const [createdTemp, setCreatedTemp] = useState<string | null>(null);
  useEffect(() => {
    if (state?.ok) {
      if (state.tempPassword) setCreatedTemp(state.tempPassword);
      else onDone();
    }
  }, [state, onDone]);

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
          <Select
            name="position"
            defaultValue={emp?.position ?? DEFAULT_POSITION}
            className="mt-1"
            options={[
              // keep an existing off-list value (old data) selectable on edit
              ...(emp?.position && !EMPLOYEE_POSITIONS.some((p) => p.key === emp.position)
                ? [{ value: emp.position, label: emp.position }]
                : []),
              ...EMPLOYEE_POSITIONS.map((p) => ({ value: p.key, label: p.label })),
            ]}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Branch</label>
          <Select
            name="branch_id"
            defaultValue={emp?.branch_id ?? defaultBranchId ?? ''}
            className="mt-1"
            options={[
              { value: '', label: '— none —' },
              ...branches.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Status</label>
          <Select
            name="status"
            defaultValue={emp?.status ?? 'active'}
            className="mt-1"
            options={EMPLOYEE_STATUSES.map((s) => ({ value: s.key, label: s.label }))}
          />
        </div>
      </div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end">
        <SubmitButton>{emp ? 'Save changes' : 'Add employee'}</SubmitButton>
      </div>
    </form>
  );
}
