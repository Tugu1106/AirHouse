// Employee read/create helpers.

import { getServiceClient } from './supabaseClient';
import { transferItem } from './transfers';
import type { ActorContext, Employee, EmployeeStatus, UUID } from './types';

export async function listEmployees(branchId?: UUID, includeDeleted = false): Promise<Employee[]> {
  const client = getServiceClient();
  let query = client.from('employees').select('*').order('name');
  if (!includeDeleted) query = query.is('deleted_at', null);
  if (branchId) query = query.eq('branch_id', branchId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Employee[];
}

/**
 * Resolve an employee by (case-insensitive) name, optionally scoped to a branch.
 * Throws a clear error on no match or ambiguity — used by the MCP tools.
 */
export async function findEmployeeByName(name: string, branchId?: UUID): Promise<Employee> {
  const client = getServiceClient();
  let query = client.from('employees').select('*').ilike('name', name.trim()).is('deleted_at', null);
  if (branchId) query = query.eq('branch_id', branchId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Employee[];
  if (rows.length === 0) throw new Error(`No employee named "${name}".`);
  if (rows.length > 1) {
    throw new Error(
      `"${name}" matches multiple employees. Specify the branch to disambiguate.`,
    );
  }
  return rows[0]!;
}

/** Resolve an employee by their login email (case-insensitive). */
export async function findEmployeeByEmail(email: string): Promise<Employee | null> {
  const client = getServiceClient();
  const { data, error } = await client
    .from('employees')
    .select('*')
    .ilike('email', email.trim())
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Employee) ?? null;
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
  const client = getServiceClient();
  const { data, error } = await client
    .from('employees')
    .insert({
      name: input.name,
      branch_id: input.branchId ?? null,
      phone: input.phone ?? null,
      position: input.position ?? null,
      status: input.status ?? 'active',
      email: input.email ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Employee;
}

// --- self-service login provisioning --------------------------------------

function genTempPassword(): string {
  // Readable characters (no look-alikes), 10 chars. crypto is a global in both
  // Node 20+ and Cloudflare Workers; cast so it type-checks under either config.
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';
  const bytes = new Uint8Array(10);
  (globalThis as unknown as { crypto: { getRandomValues: (a: Uint8Array) => void } }).crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]!).join('');
}

/**
 * Create a login for an employee: makes a Supabase Auth user with a random temp
 * password (which the worker is forced to change on first login) and links it
 * to the employee. Returns the temp password to share. Throws if a login for
 * that email already exists.
 */
export async function provisionEmployeeLogin(employeeId: UUID, email: string): Promise<string> {
  const client = getServiceClient();
  const tempPassword = genTempPassword();
  const { data, error } = await client.auth.admin.createUser({
    email: email.trim(),
    password: tempPassword,
    email_confirm: true,
    user_metadata: { must_reset: true, role: 'worker', employee_id: employeeId },
  });
  if (error) {
    throw new Error(
      /registered|exists/i.test(error.message)
        ? 'A login for this email already exists. Use "reset password" instead.'
        : error.message,
    );
  }
  const { error: linkErr } = await client
    .from('employees')
    .update({ email: email.trim(), user_id: data.user.id })
    .eq('id', employeeId);
  if (linkErr) throw new Error(linkErr.message);
  return tempPassword;
}

/** Reset an existing employee login to a new temp password (forces re-change). */
export async function resetEmployeeLogin(employeeId: UUID): Promise<string> {
  const client = getServiceClient();
  const { data: emp, error: empErr } = await client
    .from('employees')
    .select('user_id')
    .eq('id', employeeId)
    .single();
  if (empErr) throw new Error(empErr.message);
  const userId = (emp as { user_id: string | null }).user_id;
  if (!userId) throw new Error('This employee has no login yet. Create one first.');

  const tempPassword = genTempPassword();
  const { error } = await client.auth.admin.updateUserById(userId, {
    password: tempPassword,
    user_metadata: { must_reset: true, role: 'worker', employee_id: employeeId },
  });
  if (error) throw new Error(error.message);
  return tempPassword;
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
 * Soft-delete an employee: unassign each of their live items (recording the
 * change in item history), revoke their login, and mark the row deleted. The
 * row is kept so audit_log (who owned an item, and when) still resolves their
 * name.
 */
export async function deleteEmployee(id: UUID, ctx: ActorContext): Promise<void> {
  const client = getServiceClient();

  const { data: emp, error: empErr } = await client
    .from('employees')
    .select('user_id')
    .eq('id', id)
    .single();
  if (empErr) throw new Error(empErr.message);

  // Unassign each live item via a transfer, so history records "from X → nobody".
  const { data: items, error: itemsErr } = await client
    .from('items')
    .select('id')
    .eq('assigned_to', id)
    .is('deleted_at', null);
  if (itemsErr) throw new Error(itemsErr.message);
  for (const it of (items ?? []) as { id: UUID }[]) {
    await transferItem(it.id, { toEmployeeId: null, reason: 'employee_deleted' }, ctx);
  }

  // Revoke their login (best-effort — the row stays for history).
  const userId = (emp as { user_id: string | null }).user_id;
  if (userId) {
    try {
      await client.auth.admin.deleteUser(userId);
    } catch {
      /* ignore — the auth user may already be gone */
    }
  }

  // Clear email too so it frees the unique index and can be reused later.
  const { error } = await client
    .from('employees')
    .update({ deleted_at: new Date().toISOString(), user_id: null, email: null })
    .eq('id', id);
  if (error) throw new Error(error.message);
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

  const client = getServiceClient();

  // Nothing to change — return the current row instead of running an empty
  // update (Postgres errors on `.update({}).single()`).
  if (Object.keys(update).length === 0) {
    const { data, error } = await client.from('employees').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data as Employee;
  }

  const { data, error } = await client
    .from('employees')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Employee;
}
