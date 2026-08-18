'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signOutAction } from '@/lib/actions';

// Single account button in the header that opens a dropdown with the account
// controls. "Control admins" only appears for the master admin.
export function AccountMenu({
  userEmail,
  isMaster,
}: {
  userEmail: string | null;
  isMaster: boolean;
}) {
  const [open, setOpen] = useState(false);
  const initial = (userEmail?.[0] ?? '?').toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-slate-700 px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/20 text-xs font-bold text-brand-light">
          {initial}
        </span>
        <span className="hidden max-w-[150px] truncate sm:inline">{userEmail ?? 'Account'}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-500">
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <>
          {/* click-away layer */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl">
            <div className="truncate border-b border-slate-800 px-3 py-2 text-xs text-slate-500">
              {userEmail ?? 'Signed in'}
            </div>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              Change password
            </Link>
            {isMaster && (
              <Link
                href="/admins"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Control admins
              </Link>
            )}
            <form action={signOutAction} className="border-t border-slate-800">
              <button className="block w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-slate-800">
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
