import Link from 'next/link';
import { LoginForm } from '@/components/LoginForm';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getCurrentUser();
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-white">Airlink Asset Tracker</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to continue</p>
        </div>
        {user && (
          <p className="mb-4 rounded-md border border-slate-800 bg-slate-800/40 px-3 py-2 text-center text-xs text-slate-400">
            Signed in as <span className="text-slate-200">{user.email}</span>. Sign in below to
            switch accounts.
          </p>
        )}
        <LoginForm />
        <div className="mt-6 border-t border-slate-800 pt-5 text-center">
          <p className="text-sm text-slate-400">New here?</p>
          <Link
            href="/register"
            className="mt-1 inline-block text-lg font-semibold text-brand-light hover:underline"
          >
            Create an account →
          </Link>
        </div>
      </div>
    </main>
  );
}
