'use client';

import { useState } from 'react';
import { useData } from './DataProvider';
import { exportInventoryXlsx } from '@/lib/export';

// Exports ALL branches and their items to a styled .xlsx (opens in Excel and
// imports into Google Sheets). Data comes from the already-loaded bundle.
export function ExportButton() {
  const { items, branches } = useData();
  const [busy, setBusy] = useState(false);

  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          await exportInventoryXlsx({ items, branches });
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      title="Download all branches and items as an Excel sheet"
      className="rounded-md border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-60"
    >
      {busy ? 'Exporting…' : '⬇ Export Excel'}
    </button>
  );
}
