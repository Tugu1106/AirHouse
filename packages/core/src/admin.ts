// Testing/maintenance helpers — bulk wipes used to reset the database between
// test runs. Destructive and admin-only; branches are always preserved.

import { getDb } from './db';
import { deleteEmployee } from './employees';
import type { ActorContext } from './types';

/**
 * Delete EVERY item and its audit history (audit_log references items, so it
 * goes first). Branches and employees are left untouched.
 */
export async function deleteAllItems(): Promise<{ items: number }> {
  const db = getDb();
  await db.deleteFrom('audit_log').execute();
  const res = await db.deleteFrom('items').execute();
  const n = res.reduce((s, r) => s + Number(r.numDeletedRows ?? 0), 0);
  return { items: n };
}

/**
 * Delete EVERY employee via the same graceful per-employee path used by the UI:
 * each one's items are unassigned (recorded in item history), their login is
 * revoked, and the row is soft-deleted. Ownership history is preserved.
 * Branches are left untouched.
 */
export async function deleteAllEmployees(ctx: ActorContext): Promise<{ employees: number }> {
  const db = getDb();
  const rows = await db
    .selectFrom('employees')
    .select('id')
    .where('deleted_at', 'is', null)
    .execute();
  for (const row of rows) {
    await deleteEmployee(row.id, ctx);
  }
  return { employees: rows.length };
}
