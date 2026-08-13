'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAdminAction, removeAdminAction, type ActionResult } from '@/lib/actions';
import { SubmitButton } from './SubmitButton';
import { ConfirmDialog } from './ConfirmDialog';

export interface AdminRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export function AdminsView({
  admins,
  currentUserId,
}: {
  admins: AdminRow[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(createAdminAction, null);
  const [formKey, setFormKey] = useState(0);
  const [confirm, setConfirm] = useState<AdminRow | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // On a successful create the server revalidated /admins; clear the inputs
  // (remount via key) and refresh so the new row shows up.
  const created = state?.ok === true;
  useEffect(() => {
    if (created) {
      setFormKey((k) => k + 1);
      router.refresh();
    }
  }, [created, router]);

  const remove = async (a: AdminRow) => {
    setConfirm(null);
    setRemoveError(null);
    const res = await removeAdminAction(a.id);
    if (!res.ok) {
      setRemoveError(res.error);
      return;
    }
    router.refresh();
  };

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Admins</h1>
        <p className="text-sm text-slate-400">
          You are the master admin — only you can manage this list. Admins you add can do
          everything except manage admins.
        </p>
      </div>

      {/* Add admin */}
      <form
        key={formKey}
        action={formAction}
        className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-5"
      >
        <h2 className="text-sm font-semibold text-slate-200">Add an admin</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-300">Email</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="off"
              placeholder="name@airlink.mn"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">Password</label>
            <input
              name="password"
              type="text"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="at least 8 characters"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-brand focus:outline-none"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          You choose their password — share it with them, they can change it after signing in.
        </p>
        {state && !state.ok && <p className="text-sm text-red-400">{state.error}</p>}
        {created && <p className="text-sm text-emerald-400">✓ Admin added.</p>}
        <SubmitButton className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60">
          Add admin
        </SubmitButton>
      </form>

      {/* Existing admins */}
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-800/50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Added</th>
              <th className="px-4 py-3">Last sign-in</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {admins.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 font-medium text-slate-200">
                  {a.email}
                  {a.id === currentUserId && (
                    <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-xs text-brand">
                      you · master
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-400">{fmt(a.created_at)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-400">{fmt(a.last_sign_in_at)}</td>
                <td className="px-4 py-3 text-right">
                  {a.id === currentUserId || admins.length <= 1 ? (
                    <span className="text-xs text-slate-600">—</span>
                  ) : (
                    <button
                      onClick={() => setConfirm(a)}
                      className="rounded-md border border-red-900 px-2.5 py-1 text-xs text-red-300 hover:bg-red-950"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {removeError && <p className="text-sm text-red-400">⚠ {removeError}</p>}

      {confirm && (
        <ConfirmDialog
          title={`Remove ${confirm.email}?`}
          message="They will lose access immediately. Their past actions stay in the activity log. This cannot be undone."
          confirmLabel="Remove admin"
          danger
          onConfirm={() => remove(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </main>
  );
}
