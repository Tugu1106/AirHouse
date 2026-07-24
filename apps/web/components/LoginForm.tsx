'use client';

import { useActionState } from 'react';
import { signInAction, type ActionResult } from '@/lib/actions';
import { SubmitButton } from './SubmitButton';

export function LoginForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(signInAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300">Password</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>
      {state && !state.ok && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <SubmitButton className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60">
        Sign in
      </SubmitButton>
    </form>
  );
}
