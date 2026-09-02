'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getItemType } from '@airlink/core/itemTypes';
import { useData } from './DataProvider';
import { IconSearch } from './icons';

interface Result {
  key: string;
  group: 'Items' | 'Employees' | 'Branches';
  title: string;
  subtitle: string;
  href: string;
  hay: string;
}

// Global search. Opens with ⌘K / Ctrl+K, or a dispatched 'airhouse:search'
// event (the header button). Searches the already-loaded client cache, so it's
// instant. Mounted once in AppShell.
export function CommandPalette() {
  const router = useRouter();
  const { items, employees, branches } = useData();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global open triggers.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    const onEvent = () => setOpen(true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('airhouse:search', onEvent);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('airhouse:search', onEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const all = useMemo<Result[]>(() => {
    const str = (v: unknown) => (v == null || v === '' ? '' : String(v));
    const out: Result[] = [];
    for (const it of items) {
      if (it.deleted_at) continue;
      const props = it.properties as Record<string, unknown>;
      const typeLabel = getItemType(it.type)?.label ?? it.type;
      const name = str(props.model) || str(props.system_name) || str(props.serial);
      const tag = `AIR-${it.id.slice(0, 8).toUpperCase()}`;
      out.push({
        key: `i:${it.id}`,
        group: 'Items',
        title: name ? `${typeLabel} · ${name}` : typeLabel,
        subtitle: `${it.branch?.name ?? '—'} · ${it.assignee?.name ?? 'Unassigned'}`,
        href: `/item/${it.id}`,
        hay: `${typeLabel} ${JSON.stringify(props)} ${tag} ${it.assignee?.name ?? ''}`.toLowerCase(),
      });
    }
    for (const e of employees) {
      out.push({
        key: `e:${e.id}`,
        group: 'Employees',
        title: e.name,
        subtitle: `${str(e.position) || 'Employee'} · ${branches.find((b) => b.id === e.branch_id)?.name ?? '—'}`,
        href: `/employees/${e.id}`,
        hay: `${e.name} ${str(e.position)} ${str(e.phone)} ${str(e.email)}`.toLowerCase(),
      });
    }
    for (const b of branches) {
      out.push({
        key: `b:${b.id}`,
        group: 'Branches',
        title: b.name,
        subtitle: 'Branch',
        href: `/branch/${b.id}`,
        hay: b.name.toLowerCase(),
      });
    }
    return out;
  }, [items, employees, branches]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return all.filter((r) => r.hay.includes(q)).slice(0, 40);
  }, [all, query]);

  const go = (r: Result) => {
    setOpen(false);
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[active];
      if (r) go(r);
    }
  };

  if (!open) return null;

  let lastGroup = '';

  return (
    <div
      className="animate-backdrop fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/70 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="animate-modal flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-800 px-4">
          <IconSearch className="h-5 w-5 shrink-0 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search items, employees, branches…"
            className="w-full bg-transparent py-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500 sm:block">
            ESC
          </kbd>
        </div>

        <div className="overflow-y-auto p-2">
          {query.trim() === '' ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              Type to search across items, employees and branches.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">No matches for “{query}”.</p>
          ) : (
            results.map((r, i) => {
              const header = r.group !== lastGroup ? ((lastGroup = r.group), r.group) : null;
              return (
                <div key={r.key}>
                  {header && (
                    <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                      {header}
                    </div>
                  )}
                  <button
                    onClick={() => go(r)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
                      i === active ? 'bg-slate-800' : 'hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-100">{r.title}</div>
                      <div className="truncate text-xs text-slate-500">{r.subtitle}</div>
                    </div>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-600">
                      {r.group.slice(0, -1)}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
