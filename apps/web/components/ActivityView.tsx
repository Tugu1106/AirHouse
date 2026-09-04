'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { loadActivityAction, exportActivityAction } from '@/lib/actions';
import type { ActivityRow } from '@/lib/activity';

/**
 * Copy text to the clipboard. The async Clipboard API only works in a secure
 * context (HTTPS or localhost); our site runs over plain HTTP, so fall back to
 * the legacy execCommand + hidden textarea, which works everywhere.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const ACTION_LABEL: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  transfer: 'Transferred',
  soft_delete: 'Deleted',
  hard_delete: 'Purged',
};

// Color GROUPS so a whole class of action reads as one color (create = green,
// edits = blue, moves = amber, removals = red). Unknown actions stay neutral.
const ACTION_COLOR: Record<string, string> = {
  create: 'text-emerald-300',
  update: 'text-sky-300',
  transfer: 'text-amber-300',
  soft_delete: 'text-red-300',
  hard_delete: 'text-red-300',
};
const colorFor = (action: string) => ACTION_COLOR[action] ?? 'text-slate-300';

// Source badge (AI / SCAN) — a bold pill so automated changes pop out of the log.
const VIA_BADGE: Record<string, string> = {
  ai: 'bg-violet-500/25 text-violet-200 ring-violet-400/50',
  scan: 'bg-teal-500/25 text-teal-200 ring-teal-400/50',
};
const viaBadge = (via: string) => VIA_BADGE[via] ?? 'bg-slate-500/25 text-slate-200 ring-slate-400/50';

// Legend shown above the log so the colors are self-explanatory.
const LEGEND: { label: string; cls: string }[] = [
  { label: 'Created', cls: 'text-emerald-300' },
  { label: 'Updated', cls: 'text-sky-300' },
  { label: 'Transferred', cls: 'text-amber-300' },
  { label: 'Deleted / Purged', cls: 'text-red-300' },
];

// YYYY-MM-DD HH:mm:ss in the viewer's local time (sv-SE gives an ISO-like format).
const ts = (iso: string) => new Date(iso).toLocaleString('sv-SE');

// Plain-text version (used for "Copy loaded").
function terminalLine(r: ActivityRow): string {
  const verb = (ACTION_LABEL[r.action] ?? r.action).toLowerCase(); // created / updated / ...
  const [kind = '', ...rest] = r.target.split(' · ');
  const name = rest.join(' · ');
  const thing = name ? `${kind.toLowerCase()} ${name}` : kind.toLowerCase();
  const tag = r.via ? ` [${r.via.toUpperCase()}]` : '';
  return `${ts(r.when)}  ${r.actor}${tag} ${verb} ${thing}${r.detail ? ` — ${r.detail}` : ''}`;
}

// JSX version so the [AI] tag can be highlighted.
function TerminalRow({ r }: { r: ActivityRow }) {
  const verb = (ACTION_LABEL[r.action] ?? r.action).toLowerCase();
  const [kind = '', ...rest] = r.target.split(' · ');
  const name = rest.join(' · ');
  const thing = name ? `${kind.toLowerCase()} ${name}` : kind.toLowerCase();
  return (
    <span className={colorFor(r.action)}>
      {`${ts(r.when)}  ${r.actor} `}
      {r.via && (
        <span
          className={`mx-0.5 inline-block rounded px-1.5 py-px align-middle text-[10px] font-bold uppercase tracking-wider ring-1 ${viaBadge(r.via)}`}
        >
          {r.via}
        </span>
      )}
      {` ${verb} ${thing}${r.detail ? ` — ${r.detail}` : ''}`}
      {'\n'}
    </span>
  );
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
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [exporting, setExporting] = useState(false);

  // rows are kept newest-first (as the server returns them); older pages are
  // appended to the end as the user scrolls up.
  const [rows, setRows] = useState<ActivityRow[]>(initialRows);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  // Render oldest→newest so the newest sits at the bottom.
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

  // Land at the bottom (newest) on first open.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || loadingRef.current || !hasMore) return;
    if (el.scrollTop <= 48) loadOlder();
  };

  const copy = async () => {
    const ok = await copyText(allText);
    setCopyState(ok ? 'ok' : 'fail');
    setTimeout(() => setCopyState('idle'), 1600);
  };

  // Export the FULL log (not just the loaded rows) as a .txt download.
  const exportAll = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const all = await exportActivityAction();
      const text = [...all].reverse().map(terminalLine).join('\n'); // oldest → newest
      const blob = new Blob([text + '\n'], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
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
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#0a0e17]">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
          <span className="font-mono text-xs text-slate-500">
            airhouse@activity:~$ tail -f activity.log
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={copy}
              title="Copy the entries loaded so far"
              className={`rounded border px-2 py-1 text-xs transition-all duration-200 ${
                copyState === 'ok'
                  ? 'scale-105 border-emerald-500 bg-emerald-600 text-white'
                  : copyState === 'fail'
                    ? 'border-red-500 bg-red-600/80 text-white'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {copyState === 'ok' ? 'Copied ✓' : copyState === 'fail' ? 'Failed' : 'Copy loaded'}
            </button>
            <button
              onClick={exportAll}
              disabled={exporting}
              title="Download the entire log as a .txt file"
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-60"
            >
              {exporting ? 'Exporting…' : 'Full export'}
            </button>
          </div>
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
              className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-300 selection:bg-emerald-500/30"
            >
              {rows.length === 0
                ? '# no activity yet'
                : ordered.map((r) => <TerminalRow key={r.id} r={r} />)}
            </pre>
            {/* Breathing room so the newest line sits above the bottom edge,
                not glued to it. */}
            <div aria-hidden className="h-48" />
          </div>
        </div>
      </div>

      {/* Color legend — outside the terminal, below it. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-slate-500">
        <span className="uppercase tracking-wide">Legend:</span>
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full bg-current ${l.cls}`} />
            <span className={l.cls}>{l.label}</span>
          </span>
        ))}
      </div>
    </main>
  );
}
