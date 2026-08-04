// Employee read/create helpers.

import { getDb } from './db';
import { transferItem } from './transfers';
import type { ActorContext, Employee, EmployeeStatus, UUID } from './types';

// Map a DB row to the public Employee. user_id is the linked login's users.id
// (from a join) or null; the employees table itself no longer stores it.
function toEmployee(row: Record<string, unknown>): Employee {
  return {
    id: row.id as string,
    name: row.name as string,
    branch_id: (row.branch_id as string | null) ?? null,
    active: row.active as boolean,
    phone: (row.phone as string | null) ?? null,
    position: (row.position as string | null) ?? null,
    status: row.status as EmployeeStatus,
    email: (row.email as string | null) ?? null,
    user_id: (row.user_id as string | null) ?? null,
    deleted_at: (row.deleted_at as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function listEmployees(branchId?: UUID, includeDeleted = false): Promise<Employee[]> {
  const db = getDb();
  let q = db
    .selectFrom('employees as e')
    .leftJoin('users as u', 'u.employee_id', 'e.id')
    .selectAll('e')
    .select('u.id as user_id')
    .orderBy('e.name');
  if (!includeDeleted) q = q.where('e.deleted_at', 'is', null);
  if (branchId) q = q.where('e.branch_id', '=', branchId);
  return (await q.execute()).map(toEmployee);
}

export async function getEmployee(id: UUID): Promise<Employee | null> {
  const db = getDb();
  const row = await db
    .selectFrom('employees as e')
    .leftJoin('users as u', 'u.employee_id', 'e.id')
    .selectAll('e')
    .select('u.id as user_id')
    .where('e.id', '=', id)
    .executeTakeFirst();
  return row ? toEmployee(row) : null;
}

/**
 * Resolve an employee by (case-insensitive) name, optionally scoped to a branch.
 * Throws a clear error on no match or ambiguity — used by the MCP tools.
 */
export async function findEmployeeByName(name: string, branchId?: UUID): Promise<Employee> {
  const db = getDb();
  let q = db
    .selectFrom('employees')
    .selectAll()
    .where('name', 'ilike', name.trim())
    .where('deleted_at', 'is', null);
  if (branchId) q = q.where('branch_id', '=', branchId);
  const rows = await q.execute();
  if (rows.length === 0) throw new Error(`No employee named "${name}".`);
  if (rows.length > 1) {
    throw new Error(`"${name}" matches multiple employees. Specify the branch to disambiguate.`);
  }
  return toEmployee(rows[0]!);
}

/** Resolve an employee by their work email (case-insensitive). */
export async function findEmployeeByEmail(email: string): Promise<Employee | null> {
  const db = getDb();
  const row = await db
    .selectFrom('employees')
    .selectAll()
    .where('email', 'ilike', email.trim())
    .where('deleted_at', 'is', null)
    .executeTakeFirst();
  return row ? toEmployee(row) : null;
}

export interface CreateEmployeeInput {
  name: string;
  branchId?: UUID | null;
  phone?: string | null;
  position?: string | null;
  status?: EmployeeStatus;
  email?: string | null;
}

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  const db = getDb();
  const row = await db
    .insertInto('employees')
    .values({
      name: input.name,
      branch_id: input.branchId ?? null,
      phone: input.phone ?? null,
      position: input.position ?? null,
      status: input.status ?? 'active',
      email: input.email ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return toEmployee(row);
}

// --- login status ----------------------------------------------------------

export interface LoginStatus {
  /** True once the employee has signed in at least once. */
  signedIn: boolean;
  /** ISO timestamp of their last sign-in, or null if never. */
  signedInAt: string | null;
  /** Still on the one-time temp password (hasn't set their own yet). */
  mustReset: boolean;
}

/**
 * Sign-in status for every worker login, keyed by users.id (which matches an
 * employee's user_id). Tells who has logged in vs. who was only invited.
 */
export async function listLoginStatus(): Promise<Record<string, LoginStatus>> {
  const db = getDb();
  const rows = await db
    .selectFrom('users')
    .select(['id', 'last_sign_in_at', 'must_reset'])
    .where('employee_id', 'is not', null)
    .execute();
  const map: Record<string, LoginStatus> = {};
  for (const r of rows) {
    map[r.id] = {
      signedIn: r.last_sign_in_at != null,
      signedInAt: r.last_sign_in_at,
      mustReset: r.must_reset,
    };
  }
  return map;
}

export interface UpdateEmployeeInput {
  name?: string;
  branchId?: UUID | null;
  phone?: string | null;
  position?: string | null;
  status?: EmployeeStatus;
  email?: string | null;
}

/**
 * Soft-delete an employee: unassign each of their live items (recording it in
 * item history), revoke their login (delete the users row — cascades sessions),
 * and mark the row deleted. The row is kept so audit_log still resolves names.
 */
export async function deleteEmployee(id: UUID, ctx: ActorContext): Promise<void> {
  const db = getDb();

  const items = await db
    .selectFrom('items')
    .select('id')
    .where('assigned_to', '=', id)
    .where('deleted_at', 'is', null)
    .execute();
  for (const it of items) {
    await transferItem(it.id, { toEmployeeId: null, reason: 'employee_deleted' }, ctx);
  }

  await db.deleteFrom('users').where('employee_id', '=', id).execute();

  await db
    .updateTable('employees')
    .set({ deleted_at: new Date().toISOString(), email: null })
    .where('id', '=', id)
    .execute();
}

export async function updateEmployee(id: UUID, patch: UpdateEmployeeInput): Promise<Employee> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.branchId !== undefined) update.branch_id = patch.branchId;
  if (patch.phone !== undefined) update.phone = patch.phone;
  if (patch.position !== undefined) update.position = patch.position;
  if (patch.email !== undefined) update.email = patch.email;
  if (patch.status !== undefined) {
    update.status = patch.status;
    // keep the legacy `active` boolean roughly in sync with the lifecycle
    update.active = !['fired', 'resigned'].includes(patch.status);
  }

  const db = getDb();
  if (Object.keys(update).length === 0) {
    return (await getEmployee(id))!;
  }

  await db.updateTable('employees').set(update).where('id', '=', id).execute();
  return (await getEmployee(id))!;
}
