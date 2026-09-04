'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * App-wide dropdown, replacing native <select> for consistent dark-theme
 * styling. Works two ways:
 *   • controlled — pass `value` + `onChange`
 *   • form field — pass `name` (+ optional `defaultValue`); a hidden input
 *     carries the value so Server Actions read it from FormData normally.
 * The menu renders in a portal (fixed-positioned) so it is never clipped by a
 * modal's overflow.
 */
export function Select({
  options,
  value,
  defaultValue,
  onChange,
  name,
  placeholder = 'Select…',
  disabled = false,
  className = '',
}: {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? '');
  const current = isControlled ? (value as string) : internal;

  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [active, setActive] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === current);

  const place = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  };
  const openMenu = () => {
    if (disabled) return;
    place();
    setActive(options.findIndex((o) => o.value === current));
    setOpen(true);
  };
  const close = () => setOpen(false);
  const pick = (v: string) => {
    if (!isControlled) setInternal(v);
    onChange?.(v);
    close();
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      close();
    };
    const reposition = () => place();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const o = options[active];
      if (o && !o.disabled) pick(o.value);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-md border bg-slate-800/80 px-3 py-2 text-left text-sm text-slate-100 transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? 'border-brand ring-1 ring-brand' : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        <span className={`min-w-0 flex-1 break-words ${selected ? '' : 'text-slate-500'}`}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {name && <input type="hidden" name={name} value={current} />}

      {open &&
        rect &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }}
            className="animate-pop max-h-60 overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-2xl"
          >
            {options.map((o, i) => {
              const isSel = o.value === current;
              const isActive = i === active;
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={o.disabled}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o.value)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                    o.disabled
                      ? 'cursor-not-allowed text-slate-600'
                      : isSel
                        ? 'bg-brand/15 text-brand-light'
                        : isActive
                          ? 'bg-slate-800 text-slate-100'
                          : 'text-slate-300'
                  }`}
                >
                  <span className="break-words">{o.label}</span>
                  {isSel && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 shrink-0"
                      aria-hidden
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
