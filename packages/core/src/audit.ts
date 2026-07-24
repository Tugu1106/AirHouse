// Audit-log helpers. audit_log is append-only: every create/update/soft_delete/
// transfer writes exactly one row here. This is the item history.

import { getServiceClient } from './supabaseClient';
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
  const client = getServiceClient();
  const { error } = await client.from('audit_log').insert({
    item_id: entry.item_id,
    action: entry.action,
    actor: entry.actor,
    from_branch_id: entry.from_branch_id ?? null,
    to_branch_id: entry.to_branch_id ?? null,
    from_employee_id: entry.from_employee_id ?? null,
    to_employee_id: entry.to_employee_id ?? null,
    diff: entry.diff ?? null,
  });
  if (error) throw new Error(`Failed to write audit entry: ${error.message}`);
}

/** Full history for one item, newest first. */
export async function listAuditForItem(itemId: UUID): Promise<AuditLog[]> {
  const client = getServiceClient();
  const { data, error } = await client
    .from('audit_log')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditLog[];
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
