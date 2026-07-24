// Employee read/create helpers.

import { getServiceClient } from './supabaseClient';
import type { Employee, EmployeeStatus, UUID } from './types';

export async function listEmployees(branchId?: UUID): Promise<Employee[]> {
  const client = getServiceClient();
  let query = client.from('employees').select('*').order('name');
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
  let query = client.from('employees').select('*').ilike('name', name.trim());
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

export interface CreateEmployeeInput {
  name: string;
  branchId?: UUID | null;
  phone?: string | null;
  position?: string | null;
  status?: EmployeeStatus;
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
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Employee;
}

export interface UpdateEmployeeInput {
  name?: string;
  branchId?: UUID | null;
  phone?: string | null;
  position?: string | null;
  status?: EmployeeStatus;
}

/**
 * Permanently delete an employee. Any items assigned to them are unassigned
 * first so the assignee foreign key doesn't block the delete.
 */
export async function deleteEmployee(id: UUID): Promise<void> {
  const client = getServiceClient();
  const { error: unassignErr } = await client
    .from('items')
    .update({ assigned_to: null })
    .eq('assigned_to', id);
  if (unassignErr) throw new Error(unassignErr.message);
  const { error } = await client.from('employees').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateEmployee(id: UUID, patch: UpdateEmployeeInput): Promise<Employee> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.branchId !== undefined) update.branch_id = patch.branchId;
  if (patch.phone !== undefined) update.phone = patch.phone;
  if (patch.position !== undefined) update.position = patch.position;
  if (patch.status !== undefined) {
    update.status = patch.status;
    // keep the legacy `active` boolean roughly in sync with the lifecycle
    update.active = !['fired', 'resigned'].includes(patch.status);
  }

  const client = getServiceClient();
  const { data, error } = await client
    .from('employees')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Employee;
}
