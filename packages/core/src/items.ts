// Item CRUD (soft-delete only). All validation + audit logging lives here so
// every entry point (web now, MCP later) behaves identically.

import { getServiceClient } from './supabaseClient';
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
  const client = getServiceClient();

  const { data, error } = await client
    .from('items')
    .insert({
      type: input.type,
      branch_id: input.branch_id,
      assigned_to: input.assigned_to ?? null,
      status: input.status ?? 'active',
      properties,
      created_by: ctx.actorId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const item = data as Item;
  await writeAudit({
    item_id: item.id,
    action: 'create',
    actor: ctx.actorId,
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
  const client = getServiceClient();
  const before = await getItem(id);
  if (!before) throw new Error(`Item not found: ${id}`);

  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.properties !== undefined) {
    update.properties = validateProperties(before.type, patch.properties);
  }
  if (Object.keys(update).length === 0) return before;

  const { data, error } = await client
    .from('items')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  const after = data as Item;
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
  const client = getServiceClient();
  const before = await getItem(id);
  if (!before) throw new Error(`Item not found: ${id}`);
  if (before.deleted_at) return before; // already deleted; idempotent

  const { data, error } = await client
    .from('items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAudit({
    item_id: id,
    action: 'soft_delete',
    actor: ctx.actorId,
    from_branch_id: before.branch_id,
    from_employee_id: before.assigned_to,
  });
  return data as Item;
}

/** Restore a soft-deleted item (undo). */
export async function restoreItem(id: UUID, ctx: ActorContext): Promise<Item> {
  const client = getServiceClient();
  const { data, error } = await client
    .from('items')
    .update({ deleted_at: null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await writeAudit({ item_id: id, action: 'update', actor: ctx.actorId, diff: { restored: true } });
  return data as Item;
}

/** Fetch a single item regardless of deleted state (used internally + history view). */
export async function getItem(id: UUID): Promise<Item | null> {
  const client = getServiceClient();
  const { data, error } = await client.from('items').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Item) ?? null;
}
