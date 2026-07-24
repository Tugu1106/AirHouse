// Listing / filtering / sorting for items, plus a joined shape convenient for
// the UI (branch name + employee name inlined).

import { getServiceClient } from './supabaseClient';
import type { Item, ItemStatus, UUID } from './types';

export interface ItemFilters {
  branchId?: UUID;
  type?: string;
  assignedTo?: UUID | 'unassigned';
  status?: ItemStatus;
  /** free-text match against the serial/model inside properties */
  search?: string;
  /** include soft-deleted items (default false) */
  includeDeleted?: boolean;
  sortBy?: 'created_at' | 'updated_at' | 'type' | 'status';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ItemWithRelations extends Item {
  branch: { id: UUID; name: string } | null;
  assignee: { id: UUID; name: string } | null;
}

export async function listItems(filters: ItemFilters = {}): Promise<ItemWithRelations[]> {
  const client = getServiceClient();

  let query = client
    .from('items')
    .select('*, branch:branches!items_branch_id_fkey(id,name), assignee:employees!items_assigned_to_fkey(id,name)');

  if (!filters.includeDeleted) query = query.is('deleted_at', null);
  if (filters.branchId) query = query.eq('branch_id', filters.branchId);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.assignedTo === 'unassigned') query = query.is('assigned_to', null);
  else if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);

  const sortBy = filters.sortBy ?? 'created_at';
  const ascending = (filters.sortDir ?? 'desc') === 'asc';
  query = query.order(sortBy, { ascending });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as unknown as ItemWithRelations[];

  // Free-text search across the type-specific properties (serial, model, etc.).
  // Done in JS so it works reliably regardless of JSONB shape; dataset is small
  // (usage is infrequent), so this is cheap.
  const term = filters.search?.trim().toLowerCase();
  if (term) {
    rows = rows.filter((r) => {
      const hay = `${r.type} ${JSON.stringify(r.properties)} ${r.assignee?.name ?? ''}`.toLowerCase();
      return hay.includes(term);
    });
  }

  const offset = filters.offset ?? 0;
  if (filters.limit != null) rows = rows.slice(offset, offset + filters.limit);
  else if (offset) rows = rows.slice(offset);

  return rows;
}

export async function getItemWithRelations(id: UUID): Promise<ItemWithRelations | null> {
  const client = getServiceClient();
  const { data, error } = await client
    .from('items')
    .select('*, branch:branches!items_branch_id_fkey(id,name), assignee:employees!items_assigned_to_fkey(id,name)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as ItemWithRelations) ?? null;
}
