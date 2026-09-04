'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import {
  EMPLOYEE_STATUSES,
  positionsForSector,
  sectorsForBranch,
  NON_HQ_SECTOR,
} from '@airlink/core/types';
import { registerAction, type ActionResult } from '@/lib/actions';
import { hqFirst } from '@/lib/branchSort';
import { Select } from './Select';
import { SubmitButton } from './SubmitButton';

type BranchLite = { id: string; name: string; is_hq?: boolean };

export function RegisterForm({ branches }: { branches: BranchLite[] }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(registerAction, null);
  const [branch, setBranch] = useState('');
  const [sector, setSector] = useState('');
  const [position, setPosition] = useState('');

  const branchIsHq = !!(branch && branches.find((b) => b.id === branch)?.is_hq);
  const sectorOpts = sectorsForBranch(branchIsHq);
  const positionOpts = positionsForSector(sector || undefined);

  // Branch drives which sectors are allowed. Non-HQ branches only have one
  // sector, so auto-select it; HQ lets them choose.
  const onBranch = (v: string) => {
    setBranch(v);
    const hq = !!(v && branches.find((b) => b.id === v)?.is_hq);
    setSector(v && !hq ? NON_HQ_SECTOR : '');
    setPosition('');
  };

  const branchOpts = [
    { value: '', label: 'Select…' },
    ...hqFirst(branches).map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300">Full name *</label>
        <input name="name" required autoComplete="name" className="field mt-1" placeholder="Jane Doe" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-300">Work email *</label>
          <input name="email" type="email" required autoComplete="email" className="field mt-1" placeholder="jane@airlink.mn" />
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
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-300">Viber phone *</label>
          <input
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            className="field mt-1"
            placeholder="e.g. 8800xxxx"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Branch *</label>
          <Select
            name="branch_id"
            value={branch}
            onChange={onBranch}
            placeholder="Select…"
            className="mt-1"
            options={branchOpts}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Sector *</label>
          <Select
            name="sector"
            value={sector}
            onChange={(v) => {
              setSector(v);
              setPosition('');
            }}
            disabled={!branch}
            placeholder={branch ? 'Select…' : 'Pick a branch first'}
            className="mt-1"
            options={[{ value: '', label: 'Select…' }, ...sectorOpts.map((s) => ({ value: s.key, label: s.label }))]}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-300">Position *</label>
          <Select
            name="position"
            value={position}
            onChange={setPosition}
            disabled={!sector}
            placeholder={sector ? 'Select…' : 'Pick a sector first'}
            className="mt-1"
            options={[{ value: '', label: 'Select…' }, ...positionOpts.map((p) => ({ value: p.key, label: p.label }))]}
          />
        </div>
        <div className="col-span-2">
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
