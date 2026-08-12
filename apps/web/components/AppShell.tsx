'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useData } from './DataProvider';
import { DevReset } from './DevReset';
import { signOutAction } from '@/lib/actions';

const NAV = [
  { href: '/map', label: 'Map' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/employees', label: 'Employees' },
  { href: '/branches', label: 'Branches' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { userEmail, refresh, refreshing } = useData();
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href ||
    (href === '/map' && pathname === '/') ||
    (href === '/branches' && pathname.startsWith('/branch/')) ||
    (href === '/employees' && pathname.startsWith('/employees/'));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <Link href="/map" aria-label="Airlink Assets" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Airlink Assets" className="h-12 w-auto" />
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={
                  isActive(n.href)
                    ? 'rounded-md bg-slate-800 px-3 py-1.5 font-medium text-white'
                    : 'rounded-md px-3 py-1.5 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm text-slate-400">
            <DevReset />
            <button
              onClick={() => refresh()}
              disabled={refreshing}
              title="Reload data from the database"
              className="btn-ghost disabled:opacity-60"
            >
              {refreshing ? 'Refreshing…' : '↻ Refresh'}
            </button>
            <span className="hidden text-slate-500 sm:inline">{userEmail}</span>
            <form action={signOutAction}>
              <button className="btn-ghost">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
