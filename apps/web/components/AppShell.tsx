'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useData } from './DataProvider';
import { signOutAction } from '@/lib/actions';

const NAV = [
  { href: '/map', label: 'Map' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/employees', label: 'Employees' },
  { href: '/branches', label: 'Branches' },
  { href: '/activity', label: 'Log' },
];

export function AppShell({ isMaster, children }: { isMaster: boolean; children: React.ReactNode }) {
  const { userEmail } = useData();
  const pathname = usePathname();

  // The Admins link is master-admin only (the page + actions enforce it too).
  const nav = isMaster ? [...NAV, { href: '/admins', label: 'Admins' }] : NAV;

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
            <Link href="/map" aria-label="AIRHOUSE" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/favicon-32.png" alt="AIRHOUSE" className="h-9 w-9" />
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

          {/* Right: account controls */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3 text-sm text-slate-400">
            <span className="hidden text-slate-500 sm:inline">{userEmail}</span>
            <Link href="/account" className="btn-ghost">
              Change password
            </Link>
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
