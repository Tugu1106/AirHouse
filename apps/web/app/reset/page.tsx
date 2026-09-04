import { ResetPasswordForm } from '@/components/ResetPasswordForm';

export const dynamic = 'force-dynamic';

export default function ResetPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-white">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-400">
            Ask an admin for a one-time code, then set a new password below.
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
