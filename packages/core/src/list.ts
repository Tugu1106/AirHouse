// Listing / filtering / sorting for items, plus a joined shape convenient for
// the UI (branch name + employee name inlined).

import { sql } from 'kysely';
import { getDb } from './db';
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
  sortBy?: 'created_at' | 'updated_at' | 'type' | 'status' | 'sort_order';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ItemWithRelations extends Item {
  branch: { id: UUID; name: string } | null;
  assignee: { id: UUID; name: string } | null;
}

// One item row joined to its branch + assignee names.
type JoinedRow = Item & { branch_name: string | null; assignee_name: string | null };

function toRelations(r: JoinedRow): ItemWithRelations {
  const { branch_name, assignee_name, ...item } = r;
  return {
    ...item,
    branch: branch_name != null ? { id: item.branch_id, name: branch_name } : null,
    assignee:
      item.assigned_to != null && assignee_name != null
        ? { id: item.assigned_to, name: assignee_name }
        : null,
  };
}

const SORT_COLUMNS = ['created_at', 'updated_at', 'type', 'status'] as const;

export async function listItems(filters: ItemFilters = {}): Promise<ItemWithRelations[]> {
  const db = getDb();

  let query = db
    .selectFrom('items as i')
    .leftJoin('branches as b', 'b.id', 'i.branch_id')
    .leftJoin('employees as e', 'e.id', 'i.assigned_to')
    .selectAll('i')
    .select(['b.name as branch_name', 'e.name as assignee_name']);

  if (!filters.includeDeleted) query = query.where('i.deleted_at', 'is', null);
  if (filters.branchId) query = query.where('i.branch_id', '=', filters.branchId);
  if (filters.type) query = query.where('i.type', '=', filters.type);
  if (filters.status) query = query.where('i.status', '=', filters.status);
  if (filters.assignedTo === 'unassigned') query = query.where('i.assigned_to', 'is', null);
  else if (filters.assignedTo) query = query.where('i.assigned_to', '=', filters.assignedTo);

  if (filters.sortBy === 'sort_order') {
    // Manual "Custom" order (per-branch); unset rows fall to the end.
    query = query.orderBy(sql`i.sort_order asc nulls last`).orderBy('i.created_at', 'desc');
  } else {
    const sortBy = SORT_COLUMNS.includes(filters.sortBy as (typeof SORT_COLUMNS)[number])
      ? (filters.sortBy as (typeof SORT_COLUMNS)[number])
      : 'created_at';
    const dir = (filters.sortDir ?? 'desc') === 'asc' ? 'asc' : 'desc';
    query = query.orderBy(`i.${sortBy}`, dir);
  }

  let rows = (await query.execute()).map((r) => toRelations(r as unknown as JoinedRow));

  // Free-text search across the type-specific properties (serial, model, etc.),
  // done in JS so it works regardless of JSONB shape (dataset is small).
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
  const db = getDb();
  const row = await db
    .selectFrom('items as i')
    .leftJoin('branches as b', 'b.id', 'i.branch_id')
    .leftJoin('employees as e', 'e.id', 'i.assigned_to')
    .selectAll('i')
    .select(['b.name as branch_name', 'e.name as assignee_name'])
    .where('i.id', '=', id)
    .executeTakeFirst();
  return row ? toRelations(row as unknown as JoinedRow) : null;
}
