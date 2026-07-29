'use client';

import { useActionState } from 'react';
import { setPasswordAction, type ActionResult } from '@/lib/actions';
import { SubmitButton } from '@/components/SubmitButton';

export default function SetPasswordPage() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(setPasswordAction, null);

  const field =
    'mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-brand focus:outline-none';

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-white">Set your password</h1>
        <p className="mt-1 text-sm text-slate-400">
          Choose your own password to finish setting up your account.
        </p>
        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">New password</label>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">Confirm password</label>
            <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={field} />
          </div>
          {state && !state.ok && <p className="text-sm text-red-400">{state.error}</p>}
          <SubmitButton className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60">
            Save password
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
