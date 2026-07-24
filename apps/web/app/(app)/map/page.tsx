'use client';

import { useState } from 'react';
import { BranchMap } from '@/components/BranchMap';
import { BranchGeoMap } from '@/components/BranchGeoMap';

export default function MapPage() {
  const [view, setView] = useState<'node' | 'geo'>('node');
  const [editing, setEditing] = useState(false);

  const tab = (active: boolean) =>
    active
      ? 'rounded px-3 py-1 text-sm font-medium bg-slate-700 text-white'
      : 'rounded px-3 py-1 text-sm text-slate-400 hover:text-white';

  return (
    <div className="flex h-[calc(100vh-3.6rem)] flex-col">
      <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-2">
        <div className="inline-flex gap-0.5 rounded-md border border-slate-700 bg-slate-900 p-0.5">
          <button onClick={() => setView('node')} className={tab(view === 'node')}>
            Node view
          </button>
          <button onClick={() => setView('geo')} className={tab(view === 'geo')}>
            Map view
          </button>
        </div>
        {view === 'geo' && (
          <button
            onClick={() => setEditing((e) => !e)}
            className={editing ? 'btn-primary' : 'btn-ghost'}
          >
            {editing ? 'Done editing' : 'Edit layout'}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {view === 'node' ? <BranchMap /> : <BranchGeoMap editable={editing} />}
      </div>
    </div>
  );
}
