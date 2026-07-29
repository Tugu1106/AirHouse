// Testing/maintenance helpers — bulk wipes used to reset the database between
// test runs. Destructive and admin-only; branches are always preserved.

import { getServiceClient } from './supabaseClient';
import { deleteEmployee } from './employees';
import type { ActorContext, UUID } from './types';

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
 * Delete EVERY employee via the same graceful per-employee path used by the UI:
 * each one's items are unassigned (recorded in item history as "unassigned —
 * employee deleted"), their login is revoked, and the row is soft-deleted (so
 * item history still resolves who owned what). Item ownership history is
 * preserved. Branches are left untouched.
 */
export async function deleteAllEmployees(ctx: ActorContext): Promise<{ employees: number }> {
  const client = getServiceClient();

  const { data, error } = await client.from('employees').select('id').is('deleted_at', null);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: UUID }[];

  for (const row of rows) {
    await deleteEmployee(row.id, ctx);
  }
  return { employees: rows.length };
}
