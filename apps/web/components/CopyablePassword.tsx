'use client';

import { useState } from 'react';

// Clipboard API only works over HTTPS; fall back to execCommand on plain HTTP.
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** A one-time password box with a Copy button pinned to the right edge. */
export function CopyablePassword({ value, big }: { value: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2">
      <span className={`flex-1 break-all font-mono tracking-wide text-brand-light ${big ? 'text-lg' : ''}`}>
        {value}
      </span>
      <button
        onClick={copy}
        className="shrink-0 rounded border border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  );
}
