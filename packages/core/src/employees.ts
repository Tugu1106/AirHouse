// Employee read/create helpers.

import { getDb } from './db';
import { transferItem } from './transfers';
import type { ActorContext, Employee, EmployeeStatus, UUID } from './types';

// The employees table no longer stores a login id (auth lives in `users`), but
// the public Employee type still carries user_id as a soon-to-be-removed vestige
// — populate it as null until the web is moved to the new auth in Stage 3.
type EmployeeRow = Omit<Employee, 'user_id'>;
const toEmployee = (row: EmployeeRow): Employee => ({ ...row, user_id: null });

export async function listEmployees(branchId?: UUID, includeDeleted = false): Promise<Employee[]> {
  const db = getDb();
  let q = db.selectFrom('employees').selectAll().orderBy('name');
  if (!includeDeleted) q = q.where('deleted_at', 'is', null);
  if (branchId) q = q.where('branch_id', '=', branchId);
  const rows = (await q.execute()) as EmployeeRow[];
  return rows.map(toEmployee);
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
  const rows = (await q.execute()) as EmployeeRow[];
  if (rows.length === 0) throw new Error(`No employee named "${name}".`);
  if (rows.length > 1) {
    throw new Error(`"${name}" matches multiple employees. Specify the branch to disambiguate.`);
  }
  return toEmployee(rows[0]!);
}

/** Resolve an employee by their work email (case-insensitive). */
export async function findEmployeeByEmail(email: string): Promise<Employee | null> {
  const db = getDb();
  const row = (await db
    .selectFrom('employees')
    .selectAll()
    .where('email', 'ilike', email.trim())
    .where('deleted_at', 'is', null)
    .executeTakeFirst()) as EmployeeRow | undefined;
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
  const row = (await db
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
    .executeTakeFirstOrThrow()) as EmployeeRow;
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
 * Sign-in status for every worker login, keyed by employee_id. Pair with an
 * employee to tell who has logged in vs. who was only invited.
 */
export async function listLoginStatus(): Promise<Record<string, LoginStatus>> {
  const db = getDb();
  const rows = await db
    .selectFrom('users')
    .select(['employee_id', 'last_sign_in_at', 'must_reset'])
    .where('employee_id', 'is not', null)
    .execute();
  const map: Record<string, LoginStatus> = {};
  for (const r of rows) {
    if (!r.employee_id) continue;
    map[r.employee_id] = {
      signedIn: r.last_sign_in_at != null,
      signedInAt: r.last_sign_in_at,
      mustReset: r.must_reset,
    };
  }
  return map;
}

// --- self-service login provisioning ---------------------------------------

export function genTempPassword(): string {
  // Readable characters (no look-alikes), 10 chars.
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';
  const bytes = new Uint8Array(10);
  (globalThis as unknown as { crypto: { getRandomValues: (a: Uint8Array) => void } }).crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]!).join('');
}

/**
 * Create a read-only login for an employee. Rewritten with custom auth in
 * Stage 3 (bcrypt hash into the `users` table).
 */
export async function provisionEmployeeLogin(_employeeId: UUID, _email: string): Promise<string> {
  throw new Error('provisionEmployeeLogin is implemented in Stage 3 (custom auth).');
}

/** Reset an employee login to a new temp password. Implemented in Stage 3. */
export async function resetEmployeeLogin(_employeeId: UUID): Promise<string> {
  throw new Error('resetEmployeeLogin is implemented in Stage 3 (custom auth).');
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

  // Unassign each live item via a transfer, so history records "from X → nobody".
  const items = await db
    .selectFrom('items')
    .select('id')
    .where('assigned_to', '=', id)
    .where('deleted_at', 'is', null)
    .execute();
  for (const it of items) {
    await transferItem(it.id, { toEmployeeId: null, reason: 'employee_deleted' }, ctx);
  }

  // Revoke their login (sessions cascade on delete).
  await db.deleteFrom('users').where('employee_id', '=', id).execute();

  // Clear email too so it frees the unique index and can be reused later.
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

  // Nothing to change — return the current row.
  if (Object.keys(update).length === 0) {
    const row = (await db
      .selectFrom('employees')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()) as EmployeeRow;
    return toEmployee(row);
  }

  const row = (await db
    .updateTable('employees')
    .set(update)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()) as EmployeeRow;
  return toEmployee(row);
}
