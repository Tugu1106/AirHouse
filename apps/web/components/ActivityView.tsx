'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export interface ActivityRow {
  id: string;
  when: string; // ISO timestamp
  actor: string;
  action: string; // raw: create/update/transfer/soft_delete
  entity: string; // item/employee/branch
  target: string;
  targetHref?: string;
  detail: string;
}

const ACTION_LABEL: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  transfer: 'Transferred',
  soft_delete: 'Deleted',
};
const ACTION_STYLE: Record<string, string> = {
  create: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  update: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  transfer: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  soft_delete: 'bg-red-500/15 text-red-300 ring-red-500/30',
};

// YYYY-MM-DD HH:mm:ss in the viewer's local time (sv-SE gives an ISO-like format).
const ts = (iso: string) => new Date(iso).toLocaleString('sv-SE');

function terminalLine(r: ActivityRow): string {
  const action = (ACTION_LABEL[r.action] ?? r.action).toUpperCase().padEnd(11);
  const entity = r.entity.padEnd(8);
  return `${ts(r.when)}  ${r.actor.padEnd(24)}  ${action}  ${entity}  ${r.target}${
    r.detail ? `  -- ${r.detail}` : ''
  }`;
}

export function ActivityView({ rows }: { rows: ActivityRow[] }) {
  const [view, setView] = useState<'table' | 'terminal'>('table');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem('activity_view');
    if (v === 'terminal' || v === 'table') setView(v);
  }, []);
  useEffect(() => {
    localStorage.setItem('activity_view', view);
  }, [view]);

  const allText = rows.map(terminalLine).join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(allText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — user can still select the text manually */
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Activity log</h1>
          <p className="text-sm text-slate-400">
            Every change and who made it — read-only. {rows.length} most recent actions.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-md border border-slate-700 text-sm">
          <button
            onClick={() => setView('table')}
            className={
              view === 'table'
                ? 'bg-slate-700 px-3 py-1.5 font-medium text-white'
                : 'px-3 py-1.5 text-slate-400 hover:bg-slate-800'
            }
          >
            Table
          </button>
          <button
            onClick={() => setView('terminal')}
            className={
              view === 'terminal'
                ? 'bg-slate-700 px-3 py-1.5 font-medium text-white'
                : 'px-3 py-1.5 text-slate-400 hover:bg-slate-800'
            }
          >
            Terminal
          </button>
        </div>
      </div>

      {view === 'table' ? (
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-800/50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    No activity yet.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                    {new Date(r.when).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-200">{r.actor}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                        ACTION_STYLE[r.action] ?? 'bg-slate-500/15 text-slate-300 ring-slate-500/30'
                      }`}
                    >
                      {ACTION_LABEL[r.action] ?? r.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {r.targetHref ? (
                      <Link href={r.targetHref} className="hover:text-brand">
                        {r.target}
                      </Link>
                    ) : (
                      r.target
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{r.detail || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#0a0e17]">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
            <span className="font-mono text-xs text-slate-500">
              airhouse@activity:~$ tail -n {rows.length} activity.log
            </span>
            <button
              onClick={copy}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              {copied ? 'Copied ✓' : 'Copy all'}
            </button>
          </div>
          <pre className="overflow-x-auto px-3 py-3 font-mono text-xs leading-relaxed text-emerald-300 selection:bg-emerald-500/30">
            {rows.length === 0 ? '# no activity yet' : allText}
          </pre>
        </div>
      )}
    </main>
  );
}
