'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { resetPasswordAction, type ActionResult } from '@/lib/actions';
import { SubmitButton } from './SubmitButton';

const inputCls =
  'mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm focus:border-brand focus:outline-none';

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(resetPasswordAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300">Work email</label>
        <input name="email" type="email" required autoComplete="email" className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300">
          One-time code <span className="font-normal text-slate-500">(from your admin)</span>
        </label>
        <input name="code" required autoComplete="off" className={`${inputCls} font-mono tracking-wide`} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300">New password</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300">Confirm new password</label>
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
      </div>

      {state && !state.ok && <p className="text-sm text-red-400">{state.error}</p>}

      <SubmitButton className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60">
        Set new password
      </SubmitButton>

      <p className="text-center text-xs text-slate-500">
        <Link href="/login" className="text-brand-light underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
