'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { listItemTypes, getItemType, type ItemTypeDef } from '@airlink/core/itemTypes';
import { ITEM_STATUSES, type ItemStatus } from '@airlink/core/types';
import type { ItemWithRelations } from '@airlink/core';
import { useData } from './DataProvider';
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
import {
  addItemAction,
  updateItemAction,
  transferItemAction,
  reorderItemsAction,
  bulkDeleteItemsAction,
  bulkRestoreItemsAction,
  bulkHardDeleteItemsAction,
  type ActionResult,
} from '@/lib/actions';
import { SubmitButton } from './SubmitButton';
import { Select } from './Select';

type Modal = { mode: 'add' } | null;

const typeLabel = (key: string) => getItemType(key)?.label ?? key;

// Keep a dragged row moving only up/down (no sideways drift → no horizontal scroll).
const restrictVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function propertyValue(item: ItemWithRelations, key: string): string {
  const value = item.properties?.[key];
  return value == null || value === '' ? '—' : String(value);
}

export function ItemsView({ scopeBranchId }: { scopeBranchId?: string }) {
  const { items, branches, employees, refresh } = useData();
  const [modal, setModal] = useState<Modal>(null);

  // --- Select mode (bulk delete / restore) ----------------------------------
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [assignee, setAssignee] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [sort, setSort] = useState('created_at:desc');
  const [detailed, setDetailed] = useState(false);

  // Remember the compact/detailed choice and the sort across pages and reloads.
  useEffect(() => {
    setDetailed(localStorage.getItem('inventory_detailed') === '1');
    const s = localStorage.getItem('inventory_sort');
    if (s) setSort(s);
  }, []);
  useEffect(() => {
    localStorage.setItem('inventory_detailed', detailed ? '1' : '0');
  }, [detailed]);
  useEffect(() => {
    localStorage.setItem('inventory_sort', sort);
  }, [sort]);

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
    if (by === 'sort_order') {
      // Custom order: group by branch, then each branch's manual order (nulls last).
      const ord = (r: ItemWithRelations) => r.sort_order ?? Number.MAX_SAFE_INTEGER;
      rows = [...rows].sort((a, b) => {
        const ba = a.branch?.name ?? '~';
        const bb = b.branch?.name ?? '~';
        if (ba !== bb) return ba.localeCompare(bb);
        return ord(a) - ord(b);
      });
      return rows;
    }
    const key = (r: ItemWithRelations): string =>
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

  // --- Custom (manual) order via drag-and-drop --------------------------------
  // Only sensible on ONE branch with no filters/search, so a saved order stays
  // coherent. Otherwise "Custom" just displays the saved order without handles.
  const isCustom = sort === 'sort_order:asc';
  const dndEnabled =
    isCustom && !type && !status && !assignee && !search.trim() && !showDeleted && !selectMode;

  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const orderedRows = useMemo(() => {
    if (dndEnabled && dragOrder) {
      const byId = new Map(visible.map((v) => [v.id, v]));
      return dragOrder.map((id) => byId.get(id)).filter(Boolean) as ItemWithRelations[];
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
    setDragOrder(next); // optimistic

    // sort_order is per-branch: persist each branch's sub-order from the new arrangement.
    const rowById = new Map(orderedRows.map((r) => [r.id, r]));
    const byBranch = new Map<string, string[]>();
    for (const id of next) {
      const r = rowById.get(id);
      if (!r) continue;
      byBranch.set(r.branch_id, [...(byBranch.get(r.branch_id) ?? []), id]);
    }
    for (const arr of byBranch.values()) await reorderItemsAction(arr);
    await refresh();
    setDragOrder(null); // DataProvider now reflects the saved sort_order
  };

  // --- Select-mode helpers ---------------------------------------------------
  const allVisibleSelected =
    orderedRows.length > 0 && orderedRows.every((r) => selected.has(r.id));

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (allVisibleSelected) orderedRows.forEach((r) => next.delete(r.id));
      else orderedRows.forEach((r) => next.add(r.id));
      return next;
    });

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
    setConfirmBulk(false);
    setConfirmPurge(false);
  };

  const runBulkDelete = async () => {
    setBulkBusy(true);
    try {
      await bulkDeleteItemsAction([...selected]);
      await refresh();
      exitSelect();
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkRestore = async () => {
    setBulkBusy(true);
    try {
      await bulkRestoreItemsAction([...selected]);
      await refresh();
      exitSelect();
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkPurge = async () => {
    setBulkBusy(true);
    try {
      await bulkHardDeleteItemsAction([...selected]);
      await refresh();
      exitSelect();
    } finally {
      setBulkBusy(false);
    }
  };

  const cols =
    (scopeBranchId ? 6 : 7) + detailFields.length + (dndEnabled ? 1 : 0) + (selectMode ? 1 : 0);

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
          <Select
            value={type}
            onChange={setType}
            className="w-40"
            options={[
              { value: '', label: 'All types' },
              ...listItemTypes().map((t) => ({ value: t.key, label: t.label })),
            ]}
          />
        </Field>
        <Field label="Status">
          <Select
            value={status}
            onChange={setStatus}
            className="w-32"
            options={[{ value: '', label: 'All' }, ...ITEM_STATUSES.map((s) => ({ value: s, label: s }))]}
          />
        </Field>
        <Field label="Assignee">
          <Select
            value={assignee}
            onChange={setAssignee}
            className="w-44"
            options={[
              { value: '', label: 'Anyone' },
              { value: 'unassigned', label: 'Unassigned' },
              ...employees.map((e) => ({ value: e.id, label: e.name })),
            ]}
          />
        </Field>
        <Field label="Sort">
          <Select
            value={sort}
            onChange={setSort}
            className="w-44"
            options={[
              { value: 'created_at:desc', label: 'Newest' },
              { value: 'created_at:asc', label: 'Oldest' },
              { value: 'type:asc', label: 'Type A–Z' },
              { value: 'status:asc', label: 'Status' },
              { value: 'updated_at:desc', label: 'Recently updated' },
              { value: 'sort_order:asc', label: 'Custom (drag)' },
            ]}
          />
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
          <Link
            href={`/labels?${new URLSearchParams({
              ...(scopeBranchId ? { branch: scopeBranchId } : {}),
              sort,
            }).toString()}`}
            target="_blank"
            className="btn-ghost"
            title="Print QR labels in the current sort order"
          >
            🖨 Print QRs
          </Link>
          <button
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            className={
              selectMode
                ? 'rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-white'
                : 'btn-ghost'
            }
          >
            {selectMode ? 'Cancel' : 'Select'}
          </button>
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            + Add item
          </button>
        </div>
      </div>

      {/* Bulk action bar (Select mode) */}
      {selectMode && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand/40 bg-brand/10 px-4 py-2.5">
          <span className="text-sm font-medium text-slate-100">
            {selected.size} selected
          </span>
          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-slate-400 underline hover:text-slate-200"
            >
              Clear
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {showDeleted ? (
              <>
                <button
                  onClick={runBulkRestore}
                  disabled={selected.size === 0 || bulkBusy}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                >
                  Restore
                </button>
                <button
                  onClick={() => setConfirmPurge(true)}
                  disabled={selected.size === 0 || bulkBusy}
                  title="Permanently remove — cannot be undone"
                  className="rounded-md bg-red-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {bulkBusy ? 'Working…' : `Delete permanently ${selected.size || ''}`.trim()}
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmBulk(true)}
                disabled={selected.size === 0 || bulkBusy}
                className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {bulkBusy ? 'Working…' : `Delete ${selected.size || ''}`.trim()}
              </button>
            )}
          </div>
        </div>
      )}

      {isCustom && !dndEnabled && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Showing your saved custom order. Clear the filters/search to drag items into a new order.
        </div>
      )}

      {/* Table */}
      <div className="no-scrollbar overflow-x-auto rounded-lg border border-slate-800 bg-slate-900">
        <table
          className={`min-w-full divide-y divide-slate-800 ${
            detailed ? 'text-xs [&_td]:px-2.5 [&_td]:py-2.5 [&_th]:px-2.5' : 'text-sm'
          }`}
        >
          <thead className="bg-slate-800/50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {selectMode && (
                <th className="w-8 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    className="cursor-pointer accent-brand"
                  />
                </th>
              )}
              {dndEnabled && <th className="w-8 px-2 py-3"></th>}
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">System name</th>
              <th className="px-4 py-3">Model name</th>
              {detailFields.map((f) => (
                <th key={f.key} className="px-4 py-3">
                  {f.label}
                </th>
              ))}
              {!scopeBranchId && <th className="px-4 py-3">Branch</th>}
              <th className="px-4 py-3">Assigned to</th>
              <th className="px-4 py-3">Status</th>
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
                  {orderedRows.map((item) => (
                    <SortableRow key={item.id} item={item}>
                      <ItemCells item={item} detailFields={detailFields} scoped={!!scopeBranchId} />
                    </SortableRow>
                  ))}
                </tbody>
              </SortableContext>
            </DndContext>
          ) : (
            <tbody className="divide-y divide-slate-800">
              {orderedRows.length === 0 && (
                <tr>
                  <td colSpan={cols} className="px-4 py-10 text-center text-slate-400">
                    No items found.
                  </td>
                </tr>
              )}
              {orderedRows.map((item) => {
                const isSel = selected.has(item.id);
                return (
                  <tr
                    key={item.id}
                    onClick={selectMode ? () => toggleSelect(item.id) : undefined}
                    className={`${item.deleted_at ? 'bg-red-950/30' : ''} ${
                      selectMode ? 'cursor-pointer' : ''
                    } ${isSel ? 'bg-brand/10' : ''}`}
                  >
                    {selectMode && (
                      <td className="w-8 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label="Select item"
                          checked={isSel}
                          onChange={() => toggleSelect(item.id)}
                          className="cursor-pointer accent-brand"
                        />
                      </td>
                    )}
                    <ItemCells item={item} detailFields={detailFields} scoped={!!scopeBranchId} />
                  </tr>
                );
              })}
            </tbody>
          )}
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

      {confirmBulk && (
        <Dialog title={`Delete ${selected.size} item${selected.size === 1 ? '' : 's'}?`} onClose={() => setConfirmBulk(false)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              This soft-deletes the selected item{selected.size === 1 ? '' : 's'}. You can bring{' '}
              {selected.size === 1 ? 'it' : 'them'} back later with{' '}
              <span className="font-medium text-slate-200">Show deleted → Restore</span>.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmBulk(false)}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={runBulkDelete}
                disabled={bulkBusy}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {bulkBusy ? 'Deleting…' : `Delete ${selected.size}`}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {confirmPurge && (
        <Dialog
          title={`Permanently delete ${selected.size} item${selected.size === 1 ? '' : 's'}?`}
          onClose={() => setConfirmPurge(false)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              This <span className="font-semibold text-red-400">completely removes</span> the selected
              item{selected.size === 1 ? '' : 's'} from the database — no restore. A{' '}
              <span className="font-medium text-slate-200">“purged”</span> entry stays in the Activity
              Log for the record.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmPurge(false)}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={runBulkPurge}
                disabled={bulkBusy}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {bulkBusy ? 'Deleting…' : `Delete permanently`}
              </button>
            </div>
          </div>
        </Dialog>
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

// The <td> cells for one item row — shared by the plain and draggable rows.
function ItemCells({
  item,
  detailFields,
  scoped,
}: {
  item: ItemWithRelations;
  detailFields: { key: string; label: string }[];
  scoped: boolean;
}) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-slate-200">
        {typeLabel(item.type)}
        {item.deleted_at && (
          <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">deleted</span>
        )}
      </td>
      <td className="px-4 py-3 text-slate-400">{propertyValue(item, 'system_name')}</td>
      <td className="px-4 py-3 text-slate-400">{propertyValue(item, 'model')}</td>
      {detailFields.map((f) => (
        <td key={f.key} className="px-4 py-3 text-slate-400">
          {propertyValue(item, f.key)}
        </td>
      ))}
      {!scoped && <td className="px-4 py-3 text-slate-400">{item.branch?.name ?? '—'}</td>}
      <td className="px-4 py-3 text-slate-400">{item.assignee?.name ?? 'Unassigned'}</td>
      <td className="px-4 py-3">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end">
          <Link
            href={`/item/${item.id}`}
            className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800"
          >
            View
          </Link>
        </div>
      </td>
    </>
  );
}

// A draggable table row (Custom sort). The grip cell carries the drag listeners.
function SortableRow({ item, children }: { item: ItemWithRelations; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <tr ref={setNodeRef} style={style} className={item.deleted_at ? 'bg-red-950/30' : 'bg-slate-900'}>
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
      className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
        pressedBackdrop.current = false;
      }}
    >
      <div className="animate-modal flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
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
              <Select
                name={name}
                defaultValue={val}
                placeholder="—"
                className="mt-1"
                options={[{ value: '', label: '—' }, ...(f.options ?? []).map((o) => ({ value: o, label: o }))]}
              />
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
          <Select
            name="type"
            value={type}
            onChange={setType}
            className="mt-1"
            options={listItemTypes().map((t) => ({ value: t.key, label: t.label }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Status</label>
          <Select
            name="status"
            defaultValue="active"
            className="mt-1"
            options={ITEM_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Branch *</label>
          <Select
            name="branch_id"
            defaultValue={scopeBranchId ?? ''}
            placeholder="Select…"
            className="mt-1"
            options={[
              { value: '', label: 'Select…' },
              ...branches.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Assigned to</label>
          <Select
            name="assigned_to"
            defaultValue=""
            className="mt-1"
            options={[
              { value: '', label: 'Unassigned' },
              ...employees.map((e) => ({ value: e.id, label: e.name })),
            ]}
          />
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

export function EditItemForm({ item, onDone }: { item: ItemWithRelations; onDone: () => void }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateItemAction, null);
  useDoneOnSuccess(state, onDone);
  const def = getItemType(item.type);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="type" value={item.type} />
      <div>
        <label className="block text-sm font-medium text-slate-300">Status</label>
        <Select
          name="status"
          defaultValue={item.status}
          className="mt-1"
          options={ITEM_STATUSES.map((s) => ({ value: s, label: s }))}
        />
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

export function TransferForm({
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
        <Select
          name="to_employee"
          value={toEmployeeId}
          onChange={setToEmployeeId}
          disabled={!toBranchId}
          className="mt-1"
          options={[
            { value: '', label: toBranchId ? 'Unassigned' : 'Select a branch first' },
            ...branchEmployees.map((e) => ({ value: e.id, label: e.name })),
          ]}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300">Branch</label>
        <Select
          name="to_branch"
          value={toBranchId}
          onChange={(v) => {
            setToBranchId(v);
            setToEmployeeId('');
          }}
          placeholder="Select a branch"
          className="mt-1"
          options={[
            { value: '', label: 'Select a branch' },
            ...branches.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
        <p className="mt-1 text-xs text-slate-400">Choose a branch to see its employees and move the item there.</p>
      </div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end">
        <SubmitButton>Record transfer</SubmitButton>
      </div>
    </form>
  );
}
