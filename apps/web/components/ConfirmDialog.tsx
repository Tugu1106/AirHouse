'use client';

import { useRef, useState } from 'react';

// A small yes/no confirmation modal. Self-contained (renders its own backdrop)
// so it can appear on top of other dialogs. onConfirm may be async; the button
// shows a busy state until it resolves (the parent unmounts this to close).
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'No, cancel',
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const pressedBackdrop = useRef(false);
  const [busy, setBusy] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget && !busy) onCancel();
        pressedBackdrop.current = false;
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm text-slate-400">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="btn-ghost disabled:opacity-50">
            {cancelLabel}
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } catch {
                setBusy(false);
              }
            }}
            disabled={busy}
            className={
              danger
                ? 'rounded-md border border-red-800 bg-red-950/50 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-950 disabled:opacity-50'
                : 'btn-primary'
            }
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
