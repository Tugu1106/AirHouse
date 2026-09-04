'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import {
  EMPLOYEE_POSITIONS,
  EMPLOYEE_SECTORS,
  EMPLOYEE_STATUSES,
  DEFAULT_POSITION,
} from '@airlink/core/types';
import { registerAction, type ActionResult } from '@/lib/actions';
import { Select } from './Select';
import { SubmitButton } from './SubmitButton';

type BranchLite = { id: string; name: string };

export function RegisterForm({ branches }: { branches: BranchLite[] }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(registerAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300">Full name *</label>
        <input name="name" required autoComplete="name" className="field mt-1" placeholder="Jane Doe" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-300">Work email *</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="field mt-1"
            placeholder="jane@airlink.mn"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-300">Password *</label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="field mt-1"
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Branch</label>
          <Select
            name="branch_id"
            defaultValue=""
            placeholder="Select…"
            className="mt-1"
            options={[{ value: '', label: 'Select…' }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Sector</label>
          <Select
            name="sector"
            defaultValue=""
            placeholder="Select…"
            className="mt-1"
            options={[{ value: '', label: 'Select…' }, ...EMPLOYEE_SECTORS.map((s) => ({ value: s.key, label: s.label }))]}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Position</label>
          <Select
            name="position"
            defaultValue={DEFAULT_POSITION}
            className="mt-1"
            options={EMPLOYEE_POSITIONS.map((p) => ({ value: p.key, label: p.label }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Status</label>
          <Select
            name="status"
            defaultValue="active"
            className="mt-1"
            options={EMPLOYEE_STATUSES.map((s) => ({ value: s.key, label: s.label }))}
          />
        </div>
      </div>

      {state && !state.ok && <p className="text-sm text-red-400">{state.error}</p>}

      <SubmitButton className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60">
        Create account
      </SubmitButton>

      <p className="text-center text-xs text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-light underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
