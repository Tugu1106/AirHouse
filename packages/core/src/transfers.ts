// Transfers — reassigning an item to a new employee and/or moving it to a new
// branch. A transfer is a first-class action recorded in audit_log with
// from_/to_ employee and branch, not a plain edit.

import { getDb } from './db';
import { getItem } from './items';
import { writeAudit } from './audit';
import type { ActorContext, Item, UUID } from './types';

export interface TransferItemInput {
  /** New assignee. Pass null to unassign; omit to leave unchanged. */
  toEmployeeId?: UUID | null;
  /** New branch. Omit to keep the item at its current branch. */
  toBranchId?: UUID;
  /** Why this transfer happened (e.g. 'employee_deleted'), recorded in history. */
  reason?: string;
}

export async function transferItem(
  id: UUID,
  input: TransferItemInput,
  ctx: ActorContext,
): Promise<Item> {
  const before = await getItem(id);
  if (!before) throw new Error(`Item not found: ${id}`);
  if (before.deleted_at) throw new Error('Cannot transfer a deleted item.');

  const changingEmployee = input.toEmployeeId !== undefined;
  const changingBranch = input.toBranchId !== undefined && input.toBranchId !== before.branch_id;

  if (!changingEmployee && !changingBranch) {
    throw new Error('Transfer requires a new employee and/or a new branch.');
  }

  const update: Record<string, unknown> = {};
  if (changingEmployee) update.assigned_to = input.toEmployeeId ?? null;
  if (changingBranch) update.branch_id = input.toBranchId;

  const db = getDb();
  const after = (await db
    .updateTable('items')
    .set(update)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()) as Item;

  await writeAudit({
    item_id: id,
    action: 'transfer',
    actor: ctx.actorId,
    via: ctx.via,
    from_branch_id: changingBranch ? before.branch_id : null,
    to_branch_id: changingBranch ? after.branch_id : null,
    from_employee_id: changingEmployee ? before.assigned_to : null,
    to_employee_id: changingEmployee ? after.assigned_to : null,
    diff: input.reason ? { reason: input.reason } : null,
  });
  return after;
}
