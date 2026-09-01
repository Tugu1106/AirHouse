'use client';

import { useState } from 'react';

export interface Spec {
  label: string;
  value: string;
}

// "View full specs" button + modal for the public scan page. Read-only, no
// history — just the item's spec sheet. Bottom-sheet on phones, centered on
// larger screens.
export function ScanDetails({
  title,
  subtitle,
  specs,
}: {
  title: string;
  subtitle?: string;
  specs: Spec[];
}) {
  const [open, setOpen] = useState(false);
  if (specs.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
      >
        View full specs
      </button>

      {open && (
        <div
          className="animate-backdrop fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="animate-modal flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-700/60 bg-slate-900 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-white">{title}</h2>
                {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>
            <dl className="divide-y divide-slate-800 overflow-y-auto px-5">
              {specs.map((s) => (
                <div key={s.label} className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {s.label}
                  </dt>
                  <dd className="break-words text-right text-sm font-medium text-slate-100">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
