'use client';

import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { useData } from './DataProvider';
import { Dialog } from './ItemsView';
import { SubmitButton } from './SubmitButton';
import { createBranchAction, type ActionResult } from '@/lib/actions';

export function AdminBar() {
  const { refresh } = useData();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800"
      >
        + Branch
      </button>
      {open && (
        <Dialog title="Add branch" onClose={() => setOpen(false)}>
          <AddBranchForm
            onDone={async () => {
              await refresh();
              setOpen(false);
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

function AddBranchForm({ onDone }: { onDone: () => void }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(createBranchAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300">Branch name</label>
        <input name="name" required className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm" />
      </div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end">
        <SubmitButton>Add branch</SubmitButton>
      </div>
    </form>
  );
}
