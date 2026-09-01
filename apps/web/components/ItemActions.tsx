'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ItemWithRelations } from '@airlink/core';
import { getItemType } from '@airlink/core/itemTypes';
import { EditItemForm, TransferForm, Dialog } from './ItemsView';
import { ConfirmDialog } from './ConfirmDialog';
import { softDeleteItemAction, restoreItemAction } from '@/lib/actions';

type BranchLite = { id: string; name: string };
type EmployeeLite = { id: string; name: string; branch_id: string | null };

// All per-item actions in one toolbar on the item's View page: edit, transfer,
// delete/restore, and See QR (a modal — no navigation, so no back-loop).
export function ItemActions({
  item,
  branches,
  employees,
  qrSvg,
  scanLink,
}: {
  item: ItemWithRelations;
  branches: BranchLite[];
  employees: EmployeeLite[];
  qrSvg: string;
  scanLink: string;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<'edit' | 'transfer' | 'qr' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const done = () => {
    setModal(null);
    router.refresh();
  };

  const props = item.properties as Record<string, unknown>;
  const str = (v: unknown) => (v == null || v === '' ? null : String(v));
  const name = str(props.system_name) ?? str(props.model) ?? str(props.serial) ?? '';
  const tag = `AIR-${item.id.slice(0, 8).toUpperCase()}`;
  const typeLabel = getItemType(item.type)?.label ?? item.type;

  const btn = 'rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {item.deleted_at ? (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await restoreItemAction(item.id);
            setBusy(false);
            router.refresh();
          }}
          className="rounded-md border border-emerald-800 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-950 disabled:opacity-50"
        >
          Restore
        </button>
      ) : (
        <>
          <button onClick={() => setModal('edit')} className={btn}>
            Edit
          </button>
          <button onClick={() => setModal('transfer')} className={btn}>
            Transfer
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950"
          >
            Delete
          </button>
        </>
      )}
      <button onClick={() => setModal('qr')} className={btn}>
        See QR
      </button>

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
      {modal === 'qr' && (
        <Dialog title="Asset QR" onClose={() => setModal(null)}>
          <div className="qr-print-area mx-auto w-64 rounded-lg bg-white p-4 text-center text-slate-900">
            <div className="qr-img" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <div className="mt-2 text-sm font-bold">{typeLabel}</div>
            {name && <div className="text-xs text-slate-600">{name}</div>}
            <div className="mt-1 font-mono text-xs tracking-wide">{tag}</div>
          </div>
          <p className="mt-3 break-all text-center text-xs text-slate-500">{scanLink}</p>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => window.print()}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              🖨 Print
            </button>
          </div>
          <style>{`
            .qr-img svg { width: 100%; height: auto; display: block; }
            @media print {
              body * { visibility: hidden !important; }
              .qr-print-area, .qr-print-area * { visibility: visible !important; }
              .qr-print-area {
                position: fixed; left: 50%; top: 40px; transform: translateX(-50%);
                width: 320px; box-shadow: none;
              }
            }
          `}</style>
        </Dialog>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete item?"
          message="Move this item to deleted? It stays in history and can be restored."
          confirmLabel="Yes, delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await softDeleteItemAction(item.id);
            setConfirmDelete(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
