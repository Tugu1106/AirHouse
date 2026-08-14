'use client';

import { useActionState, useEffect, useState } from 'react';
import { changePasswordAction, type ActionResult } from '@/lib/actions';
import { SubmitButton } from './SubmitButton';

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    changePasswordAction,
    null,
  );
  const [formKey, setFormKey] = useState(0);

  // Clear the fields after a successful change (remount via key).
  useEffect(() => {
    if (state?.ok) setFormKey((k) => k + 1);
  }, [state]);

  const field = 'mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-brand focus:outline-none';

  return (
    <form key={formKey} action={formAction} className="panel space-y-4 p-5">
      <div>
        <label className="block text-sm font-medium text-slate-300">Current password</label>
        <input name="current" type="password" required autoComplete="current-password" className={field} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300">New password</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="at least 8 characters"
          className={field}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300">Confirm new password</label>
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={field} />
      </div>

      {state && !state.ok && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-400">✓ Password updated.</p>}

      <SubmitButton className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60">
        Update password
      </SubmitButton>
    </form>
  );
}
