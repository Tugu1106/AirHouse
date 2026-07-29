// Testing/maintenance helpers — bulk wipes used to reset the database between
// test runs. Destructive and admin-only; branches are always preserved.

import { getServiceClient } from './supabaseClient';

// Sentinel that no real row uses; `id <> this` matches every row (supabase-js
// refuses an unfiltered delete, so we give it an always-true filter).
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Delete EVERY item and its audit history (audit_log references items, so it
 * goes first). Branches and employees are left untouched.
 */
export async function deleteAllItems(): Promise<{ items: number }> {
  const client = getServiceClient();

  const audit = await client.from('audit_log').delete().neq('id', NIL_UUID).select('id');
  if (audit.error) throw new Error(audit.error.message);

  const { data, error } = await client.from('items').delete().neq('id', NIL_UUID).select('id');
  if (error) throw new Error(error.message);
  return { items: data?.length ?? 0 };
}

/**
 * Delete EVERY employee and revoke their logins. Items are kept but unassigned,
 * and audit_log employee references are cleared first so the delete doesn't trip
 * the foreign keys. Branches are left untouched.
 */
export async function deleteAllEmployees(): Promise<{ employees: number }> {
  const client = getServiceClient();

  // Revoke every provisioned Supabase Auth login (best-effort).
  const { data: withLogin, error: loginErr } = await client
    .from('employees')
    .select('user_id')
    .not('user_id', 'is', null);
  if (loginErr) throw new Error(loginErr.message);
  for (const row of (withLogin ?? []) as { user_id: string }[]) {
    try {
      await client.auth.admin.deleteUser(row.user_id);
    } catch {
      /* ignore — the auth user may already be gone */
    }
  }

  // Clear every foreign-key reference to employees before deleting them.
  const unassign = await client
    .from('items')
    .update({ assigned_to: null })
    .not('assigned_to', 'is', null);
  if (unassign.error) throw new Error(unassign.error.message);
  const clearFrom = await client
    .from('audit_log')
    .update({ from_employee_id: null })
    .not('from_employee_id', 'is', null);
  if (clearFrom.error) throw new Error(clearFrom.error.message);
  const clearTo = await client
    .from('audit_log')
    .update({ to_employee_id: null })
    .not('to_employee_id', 'is', null);
  if (clearTo.error) throw new Error(clearTo.error.message);

  const { data, error } = await client.from('employees').delete().neq('id', NIL_UUID).select('id');
  if (error) throw new Error(error.message);
  return { employees: data?.length ?? 0 };
}
