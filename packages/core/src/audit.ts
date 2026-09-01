// Audit-log helpers. audit_log is append-only: every create/update/soft_delete/
// transfer writes exactly one row here. This is the item history.

import { sql } from 'kysely';
import { getDb } from './db';
import type { AuditAction, AuditLog, UUID } from './types';

export type AuditEntityType = 'item' | 'employee' | 'branch' | 'user';

export interface AuditEntryInput {
  action: AuditAction;
  actor: UUID;
  /** What kind of thing changed. Defaults to 'item' (with entity_id = item_id). */
  entity_type?: AuditEntityType;
  /** Id of the affected entity. Defaults to item_id for item entities. */
  entity_id?: UUID;
  /** Set for item entities so the per-item history view keeps working. */
  item_id?: UUID | null;
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
      entity_type: entry.entity_type ?? 'item',
      entity_id: entry.entity_id ?? entry.item_id ?? null,
      item_id: entry.item_id ?? null,
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

export interface ItemAuditEntry extends AuditLog {
  /** Email of the user who performed the action (resolved from actor). */
  actor_email: string | null;
}

/** Full history for one item, newest first, with the actor's email resolved. */
export async function listAuditForItem(itemId: UUID): Promise<ItemAuditEntry[]> {
  const db = getDb();
  return (await db
    .selectFrom('audit_log as a')
    .leftJoin('users as u', 'u.id', 'a.actor')
    .selectAll('a')
    .select('u.email as actor_email')
    .where('a.item_id', '=', itemId)
    .orderBy('a.created_at', 'desc')
    .execute()) as unknown as ItemAuditEntry[];
}

export interface ActivityEntry extends AuditLog {
  entity_type: AuditEntityType;
  entity_id: string | null;
  /** Email of the admin who performed the action (resolved from actor). */
  actor_email: string | null;
  item_type: string | null;
  item_name: string | null;
  employee_name: string | null;
  branch_name: string | null;
}

/**
 * Global activity feed — every logged mutation across items, employees and
 * branches, newest first, with the acting admin's email and the target's name
 * resolved. Powers the read-only admin Activity Log. Only admins can mutate, so
 * this is inherently a log of admin actions, attributed per actor.
 */
export async function listActivity(limit = 100, offset = 0): Promise<ActivityEntry[]> {
  const db = getDb();
  const rows = await db
    .selectFrom('audit_log as a')
    .leftJoin('users as u', 'u.id', 'a.actor')
    .leftJoin('items as i', (j) => j.onRef('i.id', '=', 'a.entity_id').on('a.entity_type', '=', 'item'))
    .leftJoin('employees as e', (j) =>
      j.onRef('e.id', '=', 'a.entity_id').on('a.entity_type', '=', 'employee'),
    )
    .leftJoin('branches as b', (j) => j.onRef('b.id', '=', 'a.entity_id').on('a.entity_type', '=', 'branch'))
    .select([
      'a.id',
      'a.item_id',
      'a.entity_type',
      'a.entity_id',
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
      'e.name as employee_name',
      'b.name as branch_name',
    ])
    .orderBy('a.created_at', 'desc')
    .limit(limit)
    .offset(offset)
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
