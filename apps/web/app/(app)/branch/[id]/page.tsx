'use client';

import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { EMPLOYEE_STATUSES } from '@airlink/core/types';
import { useData } from '@/components/DataProvider';
import { ItemsView, Dialog } from '@/components/ItemsView';
import { EmployeeForm } from '@/components/EmployeesView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SubmitButton } from '@/components/SubmitButton';
import { branchStats, distanceKm, inMongolia, type Row } from '@/lib/branchStats';
import { BranchSkeleton } from '@/components/Skeleton';
import {
  renameBranchAction,
  deleteBranchAction,
  setBranchHqAction,
  type ActionResult,
} from '@/lib/actions';

const statusLabel = (s: string) => EMPLOYEE_STATUSES.find((x) => x.key === s)?.label ?? s;

export default function BranchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { branches, items, employees, refresh, loading } = useData();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addEmpOpen, setAddEmpOpen] = useState(false);

  const id = params.id;
  const branch = branches.find((b) => b.id === id);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-6">
        <BranchSkeleton />
      </main>
    );
  }

  if (!branch) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-slate-400">Branch not found.</p>
      </main>
    );
  }

  const staff = employees.filter((e) => e.branch_id === id);
  const { breakdown } = branchStats(id, items, employees);
  const liveItems = breakdown.reduce((s, r) => s + r.count, 0);

  // Distance from the central branch, computed from map coordinates.
  const hq = branches.find((b) => b.is_hq);
  const placed = branch.map_x != null && branch.map_y != null && inMongolia(branch.map_y, branch.map_x);
  const hqPlaced = hq?.map_x != null && hq?.map_y != null && inMongolia(hq.map_y, hq.map_x);
  let distanceLabel = '—';
  if (branch.is_hq) distanceLabel = 'Central';
  else if (!hq) distanceLabel = 'No HQ set';
  else if (!hqPlaced) distanceLabel = 'HQ not on map';
  else if (!placed) distanceLabel = 'Place on map';
  else distanceLabel = `${distanceKm(branch.map_y!, branch.map_x!, hq.map_y!, hq.map_x!).toFixed(1)} km`;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-brand-light">Branch</div>
          <h1 className="text-2xl font-semibold text-white">{branch.name}</h1>
        </div>
        <button onClick={() => setSettingsOpen(true)} className="btn-ghost">
          Settings
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Items" value={liveItems} />
        <StatTile label="Staff" value={staff.length} />
        <StatTile label="Branch №" value={branch.branch_no || '—'} />
        <StatTile label="Distance from HQ" value={distanceLabel} />
      </div>

      {/* breakdown + employees */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown rows={breakdown} />
        <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Employees ({staff.length})</h2>
            <button onClick={() => setAddEmpOpen(true)} className="btn-ghost">
              + Add employee
            </button>
          </div>
          {staff.length === 0 ? (
            <p className="text-sm text-slate-500">No employees at this branch yet.</p>
          ) : (
            <ul className="space-y-2">
              {staff.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-800/40 px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-medium text-white">{e.name}</div>
                    <div className="text-xs text-slate-400">{e.position ?? '—'}</div>
                  </div>
                  <span className="text-xs text-slate-500">{statusLabel(e.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* scoped item management */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Manage items</h2>
        <ItemsView scopeBranchId={id} />
      </section>

      {addEmpOpen && (
        <Dialog title="Add employee" onClose={() => setAddEmpOpen(false)}>
          <EmployeeForm
            branches={branches}
            defaultBranchId={id}
            onDone={async () => {
              await refresh();
              setAddEmpOpen(false);
            }}
          />
        </Dialog>
      )}

      {settingsOpen && (
        <Dialog title="Branch settings" onClose={() => setSettingsOpen(false)}>
          <BranchSettings
            branchId={id}
            currentName={branch.name}
            currentBranchNo={branch.branch_no ?? ''}
            isHq={branch.is_hq}
            blockers={{ items: items.filter((i) => i.branch_id === id).length, staff: staff.length }}
            onHqSet={refresh}
            onRenamed={async () => {
              await refresh();
              setSettingsOpen(false);
            }}
            onDeleted={async () => {
              await refresh();
              router.push('/map');
            }}
          />
        </Dialog>
      )}
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="panel p-4">
      <div className="text-3xl font-bold leading-none text-white">{value}</div>
      <div className="mt-2 text-xs uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

function Breakdown({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="panel p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-300">Item breakdown</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No items in this branch yet.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 truncate text-slate-400">{r.label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${Math.max(6, (r.count / max) * 100)}%` }}
                  title={`${r.count} ${r.label}`}
                />
              </div>
              <span className="w-6 shrink-0 text-right font-semibold text-white">{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BranchSettings({
  branchId,
  currentName,
  currentBranchNo,
  isHq,
  blockers,
  onHqSet,
  onRenamed,
  onDeleted,
}: {
  branchId: string;
  currentName: string;
  currentBranchNo: string;
  isHq: boolean;
  blockers: { items: number; staff: number };
  onHqSet: () => Promise<void> | void;
  onRenamed: () => void;
  onDeleted: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(renameBranchAction, null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [settingHq, setSettingHq] = useState(false);

  const makeCentral = async () => {
    setSettingHq(true);
    await setBranchHqAction(branchId);
    await onHqSet();
    setSettingHq(false);
  };

  useEffect(() => {
    if (state?.ok) onRenamed();
  }, [state, onRenamed]);

  const canDelete = blockers.items === 0 && blockers.staff === 0;

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="id" value={branchId} />
        <div>
          <label className="block text-sm font-medium text-slate-300">Branch name</label>
          <input name="name" defaultValue={currentName} required className="field mt-1" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Branch number</label>
          <input name="branch_no" defaultValue={currentBranchNo} placeholder="e.g. B-07" className="field mt-1" />
          <p className="mt-1 text-xs text-slate-500">
            Distance from HQ is calculated automatically from the map positions.
          </p>
        </div>
        {state && !state.ok && <p className="text-sm text-red-400">{state.error}</p>}
        <div className="flex justify-end">
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </form>

      <div className="border-t border-slate-800 pt-4">
        <h3 className="text-sm font-semibold text-slate-300">Central branch</h3>
        {isHq ? (
          <p className="mt-1 text-xs text-brand-light">★ This is the central branch.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-slate-500">
              Make this the hub shown centrally on the maps (replaces any current center).
            </p>
            <button onClick={makeCentral} disabled={settingHq} className="btn-ghost mt-2 disabled:opacity-50">
              {settingHq ? 'Setting…' : '★ Set as central branch'}
            </button>
          </>
        )}
      </div>

      <div className="border-t border-slate-800 pt-4">
        <h3 className="text-sm font-semibold text-red-400">Danger zone</h3>
        {canDelete ? (
          <p className="mt-1 text-xs text-slate-500">
            This branch is empty and can be deleted permanently.
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            You can only delete an empty branch. This one still has{' '}
            {blockers.items > 0 && <span>{blockers.items} item(s)</span>}
            {blockers.items > 0 && blockers.staff > 0 && ' and '}
            {blockers.staff > 0 && <span>{blockers.staff} employee(s)</span>} — move or reassign them
            first.
          </p>
        )}
        {deleteErr && <p className="mt-2 text-sm text-red-400">{deleteErr}</p>}
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={!canDelete}
          className="mt-3 rounded-md border border-red-800 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete branch
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete branch?"
          message="This permanently deletes the branch. This cannot be undone."
          confirmLabel="Yes, delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            const res = await deleteBranchAction(branchId);
            if (res.ok) onDeleted();
            else {
              setDeleteErr(res.error);
              setConfirmDelete(false);
            }
          }}
        />
      )}
    </div>
  );
}
