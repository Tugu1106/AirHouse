// Audit-log helpers. audit_log is append-only: every create/update/soft_delete/
// transfer writes exactly one row here. This is the item history.

import { sql } from 'kysely';
import { getDb } from './db';
import type { AuditAction, AuditLog, UUID } from './types';

export interface AuditEntryInput {
  item_id: UUID;
  action: AuditAction;
  actor: UUID;
  from_branch_id?: UUID | null;
  to_branch_id?: UUID | null;
  from_employee_id?: UUID | null;
  to_employee_id?: UUID | null;
  diff?: Record<string, unknown> | null;
}

export async function writeAudit(entry: AuditEntryInput): Promise<void> {
  const db = getDb();
  await db
    .insertInto('audit_log')
    .values({
      item_id: entry.item_id,
      action: entry.action,
      actor: entry.actor,
      from_branch_id: entry.from_branch_id ?? null,
      to_branch_id: entry.to_branch_id ?? null,
      from_employee_id: entry.from_employee_id ?? null,
      to_employee_id: entry.to_employee_id ?? null,
      diff: entry.diff ? JSON.stringify(entry.diff) : null,
    })
    .execute();
}

/** Full history for one item, newest first. */
export async function listAuditForItem(itemId: UUID): Promise<AuditLog[]> {
  const db = getDb();
  return (await db
    .selectFrom('audit_log')
    .selectAll()
    .where('item_id', '=', itemId)
    .orderBy('created_at', 'desc')
    .execute()) as AuditLog[];
}

export interface ActivityEntry extends AuditLog {
  /** Email of the admin who performed the action (resolved from actor). */
  actor_email: string | null;
  item_type: string | null;
  item_name: string | null;
}

/**
 * Global activity feed — every logged mutation (create/update/transfer/delete),
 * newest first, with the acting admin's email and the target item resolved.
 * Powers the read-only admin Activity Log page. Only admins can mutate, so this
 * is inherently a log of admin actions, attributed per actor.
 */
export async function listActivity(limit = 300): Promise<ActivityEntry[]> {
  const db = getDb();
  const rows = await db
    .selectFrom('audit_log as a')
    .leftJoin('users as u', 'u.id', 'a.actor')
    .leftJoin('items as i', 'i.id', 'a.item_id')
    .select([
      'a.id',
      'a.item_id',
      'a.action',
      'a.actor',
      'a.from_branch_id',
      'a.to_branch_id',
      'a.from_employee_id',
      'a.to_employee_id',
      'a.diff',
      'a.created_at',
      'u.email as actor_email',
      'i.type as item_type',
      sql<string | null>`coalesce(i.properties->>'system_name', i.properties->>'model', i.properties->>'serial')`.as(
        'item_name',
      ),
    ])
    .orderBy('a.created_at', 'desc')
    .limit(limit)
    .execute();
  return rows as unknown as ActivityEntry[];
}

/**
 * Compute a shallow before/after diff of two records, keeping only changed
 * top-level keys. Used to populate audit_log.diff on updates.
 */
export function shallowDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    const a = before[k];
    const b = after[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) diff[k] = { from: a, to: b };
  }
  return diff;
}
