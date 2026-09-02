'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ItemWithRelations } from '@airlink/core';
import { EditItemForm, TransferForm, Dialog } from './ItemsView';
import { IconEdit, IconTransfer } from './icons';

type BranchLite = { id: string; name: string };
type EmployeeLite = { id: string; name: string; branch_id: string | null };

// Shown on the public scan page ONLY to a signed-in admin: transfer or edit the
// scanned item right from your phone. router.refresh() re-renders the scan page
// so the owner/branch update immediately. (The actions are auth-gated server
// side too, so the buttons can't be abused.)
export function ScanAdminActions({
  item,
  branches,
  employees,
}: {
  item: ItemWithRelations;
  branches: BranchLite[];
  employees: EmployeeLite[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<'edit' | 'transfer' | null>(null);
  const done = () => {
    setModal(null);
    router.refresh();
  };

  return (
    <div className="mt-4 rounded-xl border border-brand/30 bg-brand/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-light">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Admin actions
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setModal('transfer')}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-light"
        >
          <IconTransfer /> Transfer
        </button>
        <button
          onClick={() => setModal('edit')}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
        >
          <IconEdit /> Edit
        </button>
      </div>

      {modal === 'edit' && (
        <Dialog title="Edit item" onClose={() => setModal(null)}>
          <EditItemForm item={item} onDone={done} />
        </Dialog>
      )}
      {modal === 'transfer' && (
        <Dialog title="Transfer item" onClose={() => setModal(null)}>
          <TransferForm item={item} branches={branches} employees={employees} onDone={done} />
        </Dialog>
      )}
    </div>
  );
}
