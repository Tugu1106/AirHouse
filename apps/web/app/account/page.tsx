import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/session';
import { signOutAction } from '@/lib/actions';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';

export const dynamic = 'force-dynamic';

// Self-service password change for any signed-in user (admin or worker).
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.must_reset) redirect('/set-password');
  const home = user.role === 'admin' ? '/map' : '/me';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0b1120]/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span aria-hidden className="block h-10 w-[150px]" />
          <span className="text-base font-semibold text-white">Account</span>
          <form action={signOutAction} className="ml-auto">
            <button className="btn-ghost">Sign out</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-6 py-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Change password</h1>
          <p className="mt-1 text-sm text-slate-400">Signed in as {user.email}</p>
        </div>

        <ChangePasswordForm />

        <Link href={home} className="inline-block text-sm text-slate-400 hover:text-slate-200">
          ← Back
        </Link>
      </main>
    </div>
  );
}
