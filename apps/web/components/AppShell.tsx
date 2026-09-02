'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useData } from './DataProvider';
import { AccountMenu } from './AccountMenu';
import { CommandPalette } from './CommandPalette';
import { IconSearch } from './icons';

const NAV = [
  { href: '/map', label: 'Map' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/employees', label: 'Employees' },
  { href: '/branches', label: 'Branches' },
  { href: '/activity', label: 'Log' },
  { href: '/assistant', label: 'Assistant' },
];

export function AppShell({ isMaster, children }: { isMaster: boolean; children: React.ReactNode }) {
  const { userEmail } = useData();
  const pathname = usePathname();

  // Admins now lives in the account menu ("Control admins"), not the nav.
  const nav = NAV;

  const isActive = (href: string) =>
    pathname === href ||
    (href === '/map' && pathname === '/') ||
    (href === '/branches' && pathname.startsWith('/branch/')) ||
    (href === '/employees' && pathname.startsWith('/employees/'));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center px-6 py-3">
          {/* Left: favicon alone, far left */}
          <div className="flex min-w-0 flex-1 justify-start">
            <Link href="/map" aria-label="AIRHOUSE" className="flex shrink-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/favicon-32.png" alt="" className="h-9 w-9" />
              <span className="text-lg font-bold tracking-wide text-white">AIRHOUSE</span>
            </Link>
          </div>

          {/* Center: navigation */}
          <nav className="flex flex-1 items-center justify-center gap-1 text-sm">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={
                  isActive(n.href)
                    ? 'rounded-md bg-slate-800 px-3 py-1.5 font-bold text-white'
                    : 'rounded-md px-3 py-1.5 font-bold text-white hover:bg-slate-800/60'
                }
              >
                {n.label}
              </Link>
            ))}
          </nav>

          {/* Right: search + account menu */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <button
              onClick={() => window.dispatchEvent(new Event('airhouse:search'))}
              title="Search (Ctrl+K)"
              className="flex items-center gap-2 rounded-md border border-slate-700 px-2 py-1.5 text-sm text-slate-400 transition hover:bg-slate-800 sm:px-3"
            >
              <IconSearch className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded border border-slate-700 px-1 text-[10px] text-slate-500 sm:inline">
                ⌘K
              </kbd>
            </button>
            <AccountMenu userEmail={userEmail} isMaster={isMaster} />
          </div>
        </div>
      </header>
      <CommandPalette />
      {children}
    </div>
  );
}
