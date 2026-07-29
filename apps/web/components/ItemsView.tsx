'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { listItemTypes, getItemType, type ItemTypeDef } from '@airlink/core/itemTypes';
import { ITEM_STATUSES, type ItemStatus } from '@airlink/core/types';
import type { ItemWithRelations } from '@airlink/core';
import { useData } from './DataProvider';
import {
  addItemAction,
  updateItemAction,
  transferItemAction,
  softDeleteItemAction,
  restoreItemAction,
  type ActionResult,
} from '@/lib/actions';
import { SubmitButton } from './SubmitButton';
import { ConfirmDialog } from './ConfirmDialog';

type Modal =
  | { mode: 'add' }
  | { mode: 'edit'; item: ItemWithRelations }
  | { mode: 'transfer'; item: ItemWithRelations }
  | null;

const typeLabel = (key: string) => getItemType(key)?.label ?? key;

function propertyValue(item: ItemWithRelations, key: string): string {
  const value = item.properties?.[key];
  return value == null || value === '' ? '—' : String(value);
}

export function ItemsView({ scopeBranchId }: { scopeBranchId?: string }) {
  const { items, branches, employees, refresh } = useData();
  const [modal, setModal] = useState<Modal>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ItemWithRelations | null>(null);

  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [assignee, setAssignee] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [sort, setSort] = useState('created_at:desc');
  const [detailed, setDetailed] = useState(false);

  // Remember the compact/detailed choice across pages and reloads.
  useEffect(() => {
    setDetailed(localStorage.getItem('inventory_detailed') === '1');
  }, []);
  useEffect(() => {
    localStorage.setItem('inventory_detailed', detailed ? '1' : '0');
  }, [detailed]);

  const visible = useMemo(() => {
    let rows = scopeBranchId ? items.filter((r) => r.branch_id === scopeBranchId) : items;
    if (!showDeleted) rows = rows.filter((r) => !r.deleted_at);
    if (type) rows = rows.filter((r) => r.type === type);
    if (status) rows = rows.filter((r) => r.status === status);
    if (assignee === 'unassigned') rows = rows.filter((r) => !r.assigned_to);
    else if (assignee) rows = rows.filter((r) => r.assigned_to === assignee);
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter((r) =>
        `${r.type} ${JSON.stringify(r.properties)} ${r.assignee?.name ?? ''}`
          .toLowerCase()
          .includes(term),
      );
    }
    const [by, dir] = sort.split(':');
    const key = (r: ItemWithRelations) =>
      by === 'type' ? r.type : by === 'status' ? r.status : by === 'updated_at' ? r.updated_at : r.created_at;
    rows = [...rows].sort((a, b) => {
      const av = key(a);
      const bv = key(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [items, scopeBranchId, showDeleted, type, status, assignee, search, sort]);

  // Detailed mode adds a column for every spec field of the item types present
  // in the current rows (System name / Model already have their own columns).
  const detailFields = useMemo(() => {
    if (!detailed) return [] as { key: string; label: string }[];
    const typesPresent = new Set(visible.map((r) => r.type));
    const seen = new Set<string>(['system_name', 'model']);
    const out: { key: string; label: string }[] = [];
    for (const t of listItemTypes()) {
      if (!typesPresent.has(t.key)) continue;
      for (const f of t.fields) {
        if (seen.has(f.key)) continue;
        seen.add(f.key);
        out.push({ key: f.key, label: f.label });
      }
    }
    return out;
  }, [detailed, visible]);

  async function runRowAction(id: string, action: (id: string) => Promise<ActionResult>) {
    setBusyId(id);
    try {
      await action(id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const cols = (scopeBranchId ? 6 : 7) + detailFields.length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
        <Field label="Search">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="serial, model…"
            className="w-44 rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-2 py-1.5 text-sm">
            <option value="">All types</option>
            {listItemTypes().map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-2 py-1.5 text-sm">
            <option value="">All</option>
            {ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assignee">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-2 py-1.5 text-sm">
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sort">
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-2 py-1.5 text-sm">
            <option value="created_at:desc">Newest</option>
            <option value="created_at:asc">Oldest</option>
            <option value="type:asc">Type A–Z</option>
            <option value="status:asc">Status</option>
            <option value="updated_at:desc">Recently updated</option>
          </select>
        </Field>
        <label className="flex items-center gap-1.5 text-sm text-slate-400">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          Show deleted
        </label>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-slate-700 text-sm">
            <button
              onClick={() => setDetailed(false)}
              className={
                detailed
                  ? 'px-3 py-1.5 text-slate-400 hover:bg-slate-800'
                  : 'bg-slate-700 px-3 py-1.5 font-medium text-white'
              }
            >
              Compact
            </button>
            <button
              onClick={() => setDetailed(true)}
              title="Show full specs (CPU, RAM, storage, OS…)"
              className={
                detailed
                  ? 'bg-slate-700 px-3 py-1.5 font-medium text-white'
                  : 'px-3 py-1.5 text-slate-400 hover:bg-slate-800'
              }
            >
              Detailed
            </button>
          </div>
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            + Add item
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-800/50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">System name</th>
              <th className="px-4 py-3">Model name</th>
              {detailFields.map((f) => (
                <th key={f.key} className="whitespace-nowrap px-4 py-3">
                  {f.label}
                </th>
              ))}
              {!scopeBranchId && <th className="px-4 py-3">Branch</th>}
              <th className="px-4 py-3">Assigned to</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visible.length === 0 && (
              <tr>
                <td colSpan={cols} className="px-4 py-10 text-center text-slate-400">
                  No items found.
                </td>
              </tr>
            )}
            {visible.map((item) => (
              <tr key={item.id} className={item.deleted_at ? 'bg-red-950/30' : undefined}>
                <td className="px-4 py-3 font-medium text-slate-200">
                  {typeLabel(item.type)}
                  {item.deleted_at && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">deleted</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400">{propertyValue(item, 'system_name')}</td>
                <td className="px-4 py-3 text-slate-400">{propertyValue(item, 'model')}</td>
                {detailFields.map((f) => (
                  <td key={f.key} className="whitespace-nowrap px-4 py-3 text-slate-400">
                    {propertyValue(item, f.key)}
                  </td>
                ))}
                {!scopeBranchId && <td className="px-4 py-3 text-slate-400">{item.branch?.name ?? '—'}</td>}
                <td className="px-4 py-3 text-slate-400">{item.assignee?.name ?? 'Unassigned'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2 text-sm">
                    <Link href={`/item/${item.id}`} className="text-slate-400 hover:text-brand">
                      History
                    </Link>
                    {!item.deleted_at ? (
                      <>
                        <button onClick={() => setModal({ mode: 'edit', item })} className="text-slate-400 hover:text-brand">
                          Edit
                        </button>
                        <button onClick={() => setModal({ mode: 'transfer', item })} className="text-slate-400 hover:text-brand">
                          Transfer
                        </button>
                        <button
                          onClick={() => setConfirmDelete(item)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <button
                        disabled={busyId === item.id}
                        onClick={() => runRowAction(item.id, restoreItemAction)}
                        className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.mode === 'add' && (
        <Dialog title="Add item" onClose={() => setModal(null)}>
          <AddItemForm
            branches={branches}
            employees={employees}
            scopeBranchId={scopeBranchId}
            onDone={async () => {
              await refresh();
              setModal(null);
            }}
          />
        </Dialog>
      )}
      {modal?.mode === 'edit' && (
        <Dialog title="Edit item" onClose={() => setModal(null)}>
          <EditItemForm
            item={modal.item}
            onDone={async () => {
              await refresh();
              setModal(null);
            }}
          />
        </Dialog>
      )}
      {modal?.mode === 'transfer' && (
        <Dialog title="Transfer item" onClose={() => setModal(null)}>
          <TransferForm
            item={modal.item}
            branches={branches}
            employees={employees}
            onDone={async () => {
              await refresh();
              setModal(null);
            }}
          />
        </Dialog>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete item?"
          message="Move this item to deleted? It stays in history and can be restored."
          confirmLabel="Yes, delete"
          danger
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            await softDeleteItemAction(confirmDelete.id);
            await refresh();
            setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}

// --- shared bits ----------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  const styles: Record<ItemStatus, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    in_repair: 'bg-amber-100 text-amber-700',
    retired: 'bg-slate-200 text-slate-400',
    lost: 'bg-red-100 text-red-700',
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status]}`}>{status}</span>;
}

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Close ONLY when the press AND release both happen on the backdrop itself.
  // (A drag/select that starts inside a field and ends outside won't close it.)
  const pressedBackdrop = useRef(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
        pressedBackdrop.current = false;
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-slate-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PropertyFields({ def, values }: { def: ItemTypeDef; values?: Record<string, unknown> }) {
  return (
    <>
      {def.fields.map((f) => {
        const current = values?.[f.key];
        const val = current == null ? '' : String(current);
        const name = `prop_${f.key}`;
        return (
          <div key={f.key}>
            <label className="block text-sm font-medium text-slate-300">
              {f.label}
              {f.required && <span className="text-red-500"> *</span>}
            </label>
            {f.type === 'select' ? (
              <select name={name} defaultValue={val} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm">
                <option value="">—</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea name={name} defaultValue={val} placeholder={f.placeholder} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm" />
            ) : (
              <input
                name={name}
                type={f.type === 'number' ? 'number' : 'text'}
                defaultValue={val}
                placeholder={f.placeholder}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm"
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function useDoneOnSuccess(state: ActionResult | null, onDone: () => void) {
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
}

type BranchLite = { id: string; name: string };
type EmployeeLite = { id: string; name: string; branch_id: string | null };

function AddItemForm({
  branches,
  employees,
  scopeBranchId,
  onDone,
}: {
  branches: BranchLite[];
  employees: EmployeeLite[];
  scopeBranchId?: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addItemAction, null);
  const [type, setType] = useState(listItemTypes()[0]?.key ?? 'pc');
  useDoneOnSuccess(state, onDone);
  const def = getItemType(type);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-300">Type *</label>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm">
            {listItemTypes().map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Status</label>
          <select name="status" defaultValue="active" className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm">
            {ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Branch *</label>
          <select name="branch_id" defaultValue={scopeBranchId ?? ''} required className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm">
            <option value="">Select…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Assigned to</label>
          <select name="assigned_to" defaultValue="" className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm">
            <option value="">Unassigned</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-3 border-t border-slate-800 pt-3">{def && <PropertyFields def={def} />}</div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end">
        <SubmitButton>Add item</SubmitButton>
      </div>
    </form>
  );
}

function EditItemForm({ item, onDone }: { item: ItemWithRelations; onDone: () => void }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateItemAction, null);
  useDoneOnSuccess(state, onDone);
  const def = getItemType(item.type);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="type" value={item.type} />
      <div>
        <label className="block text-sm font-medium text-slate-300">Status</label>
        <select name="status" defaultValue={item.status} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm">
          {ITEM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-3 border-t border-slate-800 pt-3">
        {def && <PropertyFields def={def} values={item.properties} />}
      </div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end">
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  );
}

function TransferForm({
  item,
  branches,
  employees,
  onDone,
}: {
  item: ItemWithRelations;
  branches: BranchLite[];
  employees: EmployeeLite[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(transferItemAction, null);
  const [toBranchId, setToBranchId] = useState('');
  const [toEmployeeId, setToEmployeeId] = useState('');
  useDoneOnSuccess(state, onDone);

  const branchEmployees = employees.filter((employee) => employee.branch_id === toBranchId);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={item.id} />
      <div>
        <label className="block text-sm font-medium text-slate-300">Assign to</label>
        <select
          name="to_employee"
          value={toEmployeeId}
          onChange={(e) => setToEmployeeId(e.target.value)}
          disabled={!toBranchId}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">{toBranchId ? 'Unassigned' : 'Select a branch first'}</option>
          {branchEmployees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300">Branch</label>
        <select
          name="to_branch"
          value={toBranchId}
          onChange={(e) => {
            setToBranchId(e.target.value);
            setToEmployeeId('');
          }}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
        >
          <option value="">Select a branch</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">Choose a branch to see its employees and move the item there.</p>
      </div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end">
        <SubmitButton>Record transfer</SubmitButton>
      </div>
    </form>
  );
}
