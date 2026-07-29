'use client';

import { useState } from 'react';
import { useData } from './DataProvider';
import { ConfirmDialog } from './ConfirmDialog';
import { deleteAllItemsAction, deleteAllEmployeesAction } from '@/lib/actions';

// Testing helper: wipe all items and/or all employees to reset between test
// runs. Lives in the global header so it's reachable from any page. Branches
// are never touched. Every wipe is behind a confirm dialog.
export function DevReset() {
  const { refresh } = useData();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | 'items' | 'employees'>(null);
  const [status, setStatus] = useState<string | null>(null);

  const run = async (what: 'items' | 'employees') => {
    const res =
      what === 'items' ? await deleteAllItemsAction() : await deleteAllEmployeesAction();
    setConfirm(null);
    if (!res.ok) {
      setStatus(`⚠ ${res.error}`);
      return;
    }
    await refresh();
    setStatus(what === 'items' ? '✓ All items deleted.' : '✓ All employees deleted.');
  };

  return (
    <>
      <button
        onClick={() => {
          setStatus(null);
          setOpen(true);
        }}
        title="Testing tools: wipe items or employees"
        className="btn-ghost"
      >
        🧪 Reset
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Reset test data</h2>
            <p className="mt-1 text-sm text-slate-400">
              For testing only. Branches are kept — these wipes cannot be undone.
            </p>

            <div className="mt-5 space-y-2">
              <button
                onClick={() => setConfirm('items')}
                className="w-full rounded-md border border-red-800 bg-red-950/50 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-950"
              >
                Delete all items
              </button>
              <button
                onClick={() => setConfirm('employees')}
                className="w-full rounded-md border border-red-800 bg-red-950/50 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-950"
              >
                Delete all employees
              </button>
            </div>

            {status && <p className="mt-4 text-sm text-slate-300">{status}</p>}

            <div className="mt-5 flex justify-end">
              <button onClick={() => setOpen(false)} className="btn-ghost">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm === 'items' && (
        <ConfirmDialog
          title="Delete ALL items?"
          message="Every item and its history will be permanently removed. Employees and branches stay. This cannot be undone."
          confirmLabel="Delete all items"
          danger
          onConfirm={() => run('items')}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'employees' && (
        <ConfirmDialog
          title="Delete ALL employees?"
          message="Every employee and their login will be permanently removed, and all items become unassigned. Branches stay. This cannot be undone."
          confirmLabel="Delete all employees"
          danger
          onConfirm={() => run('employees')}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
