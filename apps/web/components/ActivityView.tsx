'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { loadActivityAction } from '@/lib/actions';
import type { ActivityRow } from '@/lib/activity';

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
  const verb = (ACTION_LABEL[r.action] ?? r.action).toLowerCase(); // created / updated / ...
  const [kind = '', ...rest] = r.target.split(' · ');
  const name = rest.join(' · ');
  const thing = name ? `${kind.toLowerCase()} ${name}` : kind.toLowerCase();
  return `${ts(r.when)}  ${r.actor} ${verb} ${thing}${r.detail ? ` — ${r.detail}` : ''}`;
}

export function ActivityView({
  initialRows,
  pageSize,
  initialHasMore,
}: {
  initialRows: ActivityRow[];
  pageSize: number;
  initialHasMore: boolean;
}) {
  const [view, setView] = useState<'table' | 'terminal'>('terminal');
  const [copied, setCopied] = useState(false);

  // rows are kept newest-first (as the server returns them); older pages are
  // appended to the end as the user scrolls up in the terminal.
  const [rows, setRows] = useState<ActivityRow[]>(initialRows);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem('activity_log_view');
    if (v === 'terminal' || v === 'table') setView(v);
  }, []);
  useEffect(() => {
    localStorage.setItem('activity_log_view', view);
  }, [view]);

  // Terminal renders oldest→newest so the newest sits at the bottom.
  const ordered = useMemo(() => [...rows].reverse(), [rows]);
  const allText = useMemo(() => ordered.map(terminalLine).join('\n'), [ordered]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLPreElement>(null);
  const loadingRef = useRef(false);
  const restore = useRef(false);
  const prevContentH = useRef(0);

  const loadOlder = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    prevContentH.current = contentRef.current?.offsetHeight ?? 0;
    restore.current = true;
    try {
      const older = await loadActivityAction(rows.length);
      if (older.length > 0) setRows((r) => [...r, ...older]);
      setHasMore(older.length === pageSize);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [hasMore, rows.length, pageSize]);

  // After older rows are prepended (they render at the top), keep the viewport
  // steady by nudging scrollTop down by the height that was just added.
  useLayoutEffect(() => {
    if (restore.current && scrollRef.current && contentRef.current) {
      const delta = contentRef.current.offsetHeight - prevContentH.current;
      scrollRef.current.scrollTop += delta;
      restore.current = false;
    }
  }, [rows]);

  // Land at the bottom (newest) when the terminal view opens.
  useEffect(() => {
    if (view === 'terminal' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [view]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || loadingRef.current || !hasMore) return;
    if (el.scrollTop <= 48) loadOlder();
  };

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
            Every change and who made it — read-only. Newest at the bottom; scroll up for older.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-md border border-slate-700 text-sm">
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
        </div>
      </div>

      {view === 'table' ? (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-800 bg-slate-900">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="sticky top-0 bg-slate-800/90 text-left text-xs uppercase tracking-wide text-slate-400 backdrop-blur">
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
              airhouse@activity:~$ tail -f activity.log
            </span>
            <button
              onClick={copy}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              {copied ? 'Copied ✓' : 'Copy loaded'}
            </button>
          </div>
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="flex h-[65vh] flex-col overflow-y-auto px-3 py-3"
          >
            {/* mt-auto keeps a short log pinned to the bottom (newest); once it
                overflows the margin collapses and normal scroll-up kicks in. */}
            <div className="mt-auto">
              <div className="mb-2 text-center font-mono text-[11px] text-slate-600">
                {loading
                  ? 'loading older…'
                  : hasMore
                    ? '↑ scroll up for older entries'
                    : '— beginning of log —'}
              </div>
              <pre
                ref={contentRef}
                className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-emerald-300 selection:bg-emerald-500/30"
              >
                {rows.length === 0 ? '# no activity yet' : allText}
              </pre>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
