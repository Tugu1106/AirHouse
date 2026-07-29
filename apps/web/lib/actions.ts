'use server';

// Server Actions — the web app's entry point into @airlink/core. These do no
// business logic themselves; they read the current admin, parse form input, and
// delegate to core (which owns validation, audit logging, soft-delete rules).

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  addItem,
  updateItem,
  softDeleteItem,
  restoreItem,
  transferItem,
  createBranch,
  updateBranch,
  deleteBranch,
  setBranchAsHq,
  updateBranchPosition,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  provisionEmployeeLogin,
  resetEmployeeLogin,
  getItemType,
  type ItemStatus,
  type EmployeeStatus,
} from '@airlink/core';
import { requireActor } from './auth';
import { createSupabaseServerClient } from './supabase/server';

export type ActionResult = { ok: true; tempPassword?: string } | { ok: false; error: string };

// --- helpers --------------------------------------------------------------

function extractProperties(typeKey: string, formData: FormData): Record<string, unknown> {
  const def = getItemType(typeKey);
  if (!def) return {};
  const props: Record<string, unknown> = {};
  for (const field of def.fields) {
    const raw = formData.get(`prop_${field.key}`);
    if (raw != null && String(raw).trim() !== '') props[field.key] = String(raw);
  }
  return props;
}

function errMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'issues' in e) {
    // ZodError — surface the first friendly message
    const issues = (e as { issues: { message: string }[] }).issues;
    return issues.map((i) => i.message).join(', ');
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

// --- auth -----------------------------------------------------------------

export async function signInAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  // Route by state/role: forced reset → admin → worker.
  if (data.user?.user_metadata?.must_reset) redirect('/set-password');
  const adminEmail = (process.env.ADMIN_EMAIL ?? '').toLowerCase();
  const isAdmin = !adminEmail || data.user?.email?.toLowerCase() === adminEmail;
  redirect(isAdmin ? '/map' : '/me');
}

export async function setPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
  if (password !== confirm) return { ok: false, error: 'Passwords do not match.' };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { error } = await supabase.auth.updateUser({ password, data: { must_reset: false } });
  if (error) return { ok: false, error: error.message };

  const adminEmail = (process.env.ADMIN_EMAIL ?? '').toLowerCase();
  const isAdmin = !adminEmail || user.email?.toLowerCase() === adminEmail;
  redirect(isAdmin ? '/map' : '/me');
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

// --- employee login provisioning (admin) ----------------------------------

export async function createEmployeeLoginAction(id: string, email: string): Promise<ActionResult> {
  try {
    await requireActor();
    const tempPassword = await provisionEmployeeLogin(id, email.trim());
    return { ok: true, tempPassword };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function resetEmployeeLoginAction(id: string): Promise<ActionResult> {
  try {
    await requireActor();
    const tempPassword = await resetEmployeeLogin(id);
    return { ok: true, tempPassword };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

// --- items ----------------------------------------------------------------

export async function addItemAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireActor();
    const type = String(formData.get('type') ?? '');
    const branch_id = String(formData.get('branch_id') ?? '');
    const assignedRaw = String(formData.get('assigned_to') ?? '');
    const status = String(formData.get('status') ?? 'active') as ItemStatus;
    if (!type) return { ok: false, error: 'Item type is required' };
    if (!branch_id) return { ok: false, error: 'Branch is required' };

    await addItem(
      {
        type,
        branch_id,
        assigned_to: assignedRaw || null,
        status,
        properties: extractProperties(type, formData),
      },
      ctx,
    );
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  revalidatePath('/dashboard');
  revalidatePath('/branch', 'layout');
  return { ok: true };
}

export async function updateItemAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireActor();
    const id = String(formData.get('id') ?? '');
    const type = String(formData.get('type') ?? '');
    const status = String(formData.get('status') ?? 'active') as ItemStatus;
    if (!id) return { ok: false, error: 'Missing item id' };
    await updateItem(id, { status, properties: extractProperties(type, formData) }, ctx);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  revalidatePath('/dashboard');
  revalidatePath('/branch', 'layout');
  return { ok: true };
}

export async function transferItemAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireActor();
    const id = String(formData.get('id') ?? '');
    const toEmployeeRaw = formData.get('to_employee');
    const toBranchRaw = String(formData.get('to_branch') ?? '');
    if (!id) return { ok: false, error: 'Missing item id' };

    const input: { toEmployeeId?: string | null; toBranchId?: string } = {};
    if (toEmployeeRaw != null) input.toEmployeeId = String(toEmployeeRaw) || null;
    if (toBranchRaw) input.toBranchId = toBranchRaw;

    await transferItem(id, input, ctx);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  revalidatePath('/dashboard');
  revalidatePath('/branch', 'layout');
  return { ok: true };
}

export async function softDeleteItemAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireActor();
    if (id) await softDeleteItem(id, ctx);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

export async function restoreItemAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireActor();
    if (id) await restoreItem(id, ctx);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

// --- branches / employees -------------------------------------------------

export async function createBranchAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireActor();
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return { ok: false, error: 'Branch name is required' };
    await createBranch(name);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function renameBranchAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireActor();
    const id = String(formData.get('id') ?? '');
    const name = String(formData.get('name') ?? '').trim();
    if (!id) return { ok: false, error: 'Missing branch id' };
    if (!name) return { ok: false, error: 'Branch name is required' };
    await updateBranch(id, {
      name,
      branchNo: String(formData.get('branch_no') ?? '').trim() || null,
    });
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

export async function deleteBranchAction(id: string): Promise<ActionResult> {
  try {
    await requireActor();
    await deleteBranch(id);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

export async function setBranchHqAction(id: string): Promise<ActionResult> {
  try {
    await requireActor();
    await setBranchAsHq(id);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

export async function setBranchPositionAction(
  id: string,
  x: number,
  y: number,
): Promise<ActionResult> {
  try {
    await requireActor();
    await updateBranchPosition(id, x, y);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

export async function createEmployeeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireActor();
    const name = String(formData.get('name') ?? '').trim();
    const branchId = String(formData.get('branch_id') ?? '') || null;
    const email = String(formData.get('email') ?? '').trim() || null;
    if (!name) return { ok: false, error: 'Employee name is required' };
    const emp = await createEmployee({
      name,
      branchId,
      phone: String(formData.get('phone') ?? '').trim() || null,
      position: String(formData.get('position') ?? '').trim() || null,
      status: (String(formData.get('status') ?? '') as EmployeeStatus) || undefined,
      email,
    });
    // If an email was given, provision their read-only login and surface the temp password.
    if (email) {
      const tempPassword = await provisionEmployeeLogin(emp.id, email);
      return { ok: true, tempPassword };
    }
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

export async function deleteEmployeeAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireActor();
    await deleteEmployee(id, ctx);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

export async function updateEmployeeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireActor();
    const id = String(formData.get('id') ?? '');
    if (!id) return { ok: false, error: 'Missing employee id' };
    const branchRaw = formData.get('branch_id');
    await updateEmployee(id, {
      name: String(formData.get('name') ?? '').trim() || undefined,
      phone: formData.has('phone') ? String(formData.get('phone') ?? '').trim() || null : undefined,
      position: formData.has('position')
        ? String(formData.get('position') ?? '').trim() || null
        : undefined,
      status: (String(formData.get('status') ?? '') as EmployeeStatus) || undefined,
      branchId: branchRaw !== null ? String(branchRaw) || null : undefined,
    });
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}
