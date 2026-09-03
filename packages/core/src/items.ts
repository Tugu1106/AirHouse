// Item CRUD (soft-delete only). All validation + audit logging lives here so
// every entry point (web + MCP) behaves identically.

import { getDb } from './db';
import { validateProperties } from './itemTypes';
import { writeAudit, shallowDiff } from './audit';
import type { ActorContext, Item, ItemStatus, UUID } from './types';

export interface AddItemInput {
  type: string;
  branch_id: UUID;
  assigned_to?: UUID | null;
  status?: ItemStatus;
  properties?: Record<string, unknown>;
}

export async function addItem(input: AddItemInput, ctx: ActorContext): Promise<Item> {
  const properties = validateProperties(input.type, input.properties ?? {});
  const db = getDb();

  const item = (await db
    .insertInto('items')
    .values({
      type: input.type,
      branch_id: input.branch_id,
      assigned_to: input.assigned_to ?? null,
      status: input.status ?? 'active',
      properties: JSON.stringify(properties),
      created_by: ctx.actorId,
    })
    .returningAll()
    .executeTakeFirstOrThrow()) as Item;

  await writeAudit({
    item_id: item.id,
    action: 'create',
    actor: ctx.actorId,
    via: ctx.via,
    to_branch_id: item.branch_id,
    to_employee_id: item.assigned_to,
    diff: { created: { type: item.type, status: item.status, properties: item.properties } },
  });
  return item;
}

export interface UpdateItemInput {
  status?: ItemStatus;
  properties?: Record<string, unknown>;
}

/**
 * Edit an item's status and/or type-specific properties. Ownership/branch
 * changes go through transferItem, not here — a transfer is a first-class
 * action, not an edit.
 */
export async function updateItem(
  id: UUID,
  patch: UpdateItemInput,
  ctx: ActorContext,
): Promise<Item> {
  const db = getDb();
  const before = await getItem(id);
  if (!before) throw new Error(`Item not found: ${id}`);

  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.properties !== undefined) {
    update.properties = JSON.stringify(validateProperties(before.type, patch.properties));
  }
  if (Object.keys(update).length === 0) return before;

  const after = (await db
    .updateTable('items')
    .set(update)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()) as Item;

  await writeAudit({
    item_id: id,
    action: 'update',
    actor: ctx.actorId,
    diff: shallowDiff(
      { status: before.status, properties: before.properties },
      { status: after.status, properties: after.properties },
    ),
  });
  return after;
}

/** Soft delete — sets deleted_at, never removes the row. */
export async function softDeleteItem(id: UUID, ctx: ActorContext): Promise<Item> {
  const db = getDb();
  const before = await getItem(id);
  if (!before) throw new Error(`Item not found: ${id}`);
  if (before.deleted_at) return before; // already deleted; idempotent

  const after = (await db
    .updateTable('items')
    .set({ deleted_at: new Date().toISOString() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()) as Item;

  await writeAudit({
    item_id: id,
    action: 'soft_delete',
    actor: ctx.actorId,
    from_branch_id: before.branch_id,
    from_employee_id: before.assigned_to,
  });
  return after;
}

/** Restore a soft-deleted item (undo). */
export async function restoreItem(id: UUID, ctx: ActorContext): Promise<Item> {
  const db = getDb();
  const after = (await db
    .updateTable('items')
    .set({ deleted_at: null })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()) as Item;
  await writeAudit({ item_id: id, action: 'update', actor: ctx.actorId, diff: { restored: true } });
  return after;
}

/** Fetch a single item regardless of deleted state (used internally + history view). */
export async function getItem(id: UUID): Promise<Item | null> {
  const db = getDb();
  const row = await db.selectFrom('items').selectAll().where('id', '=', id).executeTakeFirst();
  return (row as Item) ?? null;
}

/**
 * Persist a manual "Custom" order: sort_order = index for each id, in the given
 * order. Called with the ids of one branch's items. No audit (cosmetic).
 */
export async function reorderItems(orderedIds: UUID[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const db = getDb();
  await db.transaction().execute(async (trx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await trx.updateTable('items').set({ sort_order: i }).where('id', '=', orderedIds[i]!).execute();
    }
  });
}
