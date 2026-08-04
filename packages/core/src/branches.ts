// Branch read/create helpers.

import { getDb } from './db';
import type { Branch, UUID } from './types';

export async function listBranches(): Promise<Branch[]> {
  const db = getDb();
  return (await db.selectFrom('branches').selectAll().orderBy('name').execute()) as Branch[];
}

export async function getBranch(id: UUID): Promise<Branch | null> {
  const db = getDb();
  const row = await db.selectFrom('branches').selectAll().where('id', '=', id).executeTakeFirst();
  return (row as Branch) ?? null;
}

/**
 * Resolve a branch by (case-insensitive) name. Throws a clear error if there is
 * no match or more than one — used by the MCP tools so Claude can pass names.
 */
export async function findBranchByName(name: string): Promise<Branch> {
  const db = getDb();
  const rows = (await db
    .selectFrom('branches')
    .selectAll()
    .where('name', 'ilike', name.trim())
    .execute()) as Branch[];
  if (rows.length === 0) throw new Error(`No branch named "${name}".`);
  if (rows.length > 1) {
    throw new Error(`"${name}" matches multiple branches: ${rows.map((b) => b.name).join(', ')}.`);
  }
  return rows[0]!;
}

export async function createBranch(name: string): Promise<Branch> {
  const db = getDb();
  return (await db
    .insertInto('branches')
    .values({ name })
    .returningAll()
    .executeTakeFirstOrThrow()) as Branch;
}

/** Make one branch the central/HQ branch, clearing the flag from all others. */
export async function setBranchAsHq(id: UUID): Promise<void> {
  const db = getDb();
  await db.updateTable('branches').set({ is_hq: false }).where('id', '!=', id).execute();
  await db.updateTable('branches').set({ is_hq: true }).where('id', '=', id).execute();
}

export interface UpdateBranchInput {
  name?: string;
  branchNo?: string | null;
  distanceHq?: string | null;
}

export async function updateBranch(id: UUID, patch: UpdateBranchInput): Promise<Branch> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.branchNo !== undefined) update.branch_no = patch.branchNo;
  if (patch.distanceHq !== undefined) update.distance_hq = patch.distanceHq;

  const db = getDb();
  if (Object.keys(update).length === 0) {
    return (await db
      .selectFrom('branches')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()) as Branch;
  }

  return (await db
    .updateTable('branches')
    .set(update)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()) as Branch;
}

/**
 * Hard-delete a branch — allowed only when nothing references it (items point at
 * a branch via a NOT NULL FK, so a non-empty branch cannot be removed safely).
 */
export async function deleteBranch(id: UUID): Promise<void> {
  const db = getDb();

  const items = await db
    .selectFrom('items')
    .select((eb) => eb.fn.countAll<string>().as('c'))
    .where('branch_id', '=', id)
    .executeTakeFirst();
  if (Number(items?.c ?? 0) > 0) {
    throw new Error('Cannot delete: this branch still has items. Move or remove them first.');
  }

  const emps = await db
    .selectFrom('employees')
    .select((eb) => eb.fn.countAll<string>().as('c'))
    .where('branch_id', '=', id)
    .executeTakeFirst();
  if (Number(emps?.c ?? 0) > 0) {
    throw new Error('Cannot delete: this branch still has employees. Reassign them first.');
  }

  await db.deleteFrom('branches').where('id', '=', id).execute();
}

/** Save a branch's position on the custom map view (fractions 0..1). */
export async function updateBranchPosition(id: UUID, mapX: number, mapY: number): Promise<Branch> {
  const db = getDb();
  return (await db
    .updateTable('branches')
    .set({ map_x: mapX, map_y: mapY })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()) as Branch;
}

/** Item counts per branch (live items only) — used by the dashboard cards. */
export async function branchItemCounts(): Promise<Record<UUID, number>> {
  const db = getDb();
  const rows = await db
    .selectFrom('items')
    .select((eb) => ['branch_id', eb.fn.countAll<string>().as('c')])
    .where('deleted_at', 'is', null)
    .groupBy('branch_id')
    .execute();
  const counts: Record<UUID, number> = {};
  for (const r of rows) counts[r.branch_id] = Number(r.c);
  return counts;
}
