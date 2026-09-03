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
  reorderItems,
  reorderEmployees,
  createAdmin,
  removeAdmin,
  verifyCredentials,
  createSession,
  setUserPassword,
  deleteSession,
  getItemType,
  type ItemStatus,
  type EmployeeStatus,
} from '@airlink/core';
import { getRole, requireAdmin, requireMasterAdmin } from './auth';
import { getActivityPage, getAllActivity, ACTIVITY_PAGE_SIZE, type ActivityRow } from './activity';
import {
  getCurrentUser,
  getSessionId,
  setSessionCookie,
  clearSessionCookie,
} from './session';

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

  let user;
  try {
    user = await verifyCredentials(email, password);
    if (!user) return { ok: false, error: 'Invalid email or password.' };
    // Switching accounts (or re-login): drop any prior session so it doesn't linger.
    const oldId = await getSessionId();
    if (oldId) {
      try {
        await deleteSession(oldId);
      } catch {
        /* ignore */
      }
    }
    const session = await createSession(user.id);
    await setSessionCookie(session.id, session.expiresAt);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }

  // Route by state/role: forced reset → admin → worker.
  if (user.must_reset) redirect('/set-password');
  redirect(user.role === 'admin' ? '/map' : '/me');
}

export async function setPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
  if (password !== confirm) return { ok: false, error: 'Passwords do not match.' };

  let role: 'admin' | 'worker';
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: 'Not authenticated' };
    await setUserPassword(user.id, password);
    role = user.role;
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  redirect(role === 'admin' ? '/map' : '/me');
}

export async function changePasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const current = String(formData.get('current') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: 'Not authenticated' };
    if (password.length < 8) return { ok: false, error: 'New password must be at least 8 characters.' };
    if (password !== confirm) return { ok: false, error: 'New passwords do not match.' };
    const ok = await verifyCredentials(user.email, current);
    if (!ok) return { ok: false, error: 'Current password is incorrect.' };
    await setUserPassword(user.id, password);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const id = await getSessionId();
  if (id) {
    try {
      await deleteSession(id);
    } catch {
      /* ignore */
    }
  }
  await clearSessionCookie();
  redirect('/login');
}

// --- employee login provisioning (admin) ----------------------------------

export async function createEmployeeLoginAction(id: string, email: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    const tempPassword = await provisionEmployeeLogin(id, email.trim(), ctx);
    return { ok: true, tempPassword };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function resetEmployeeLoginAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    const tempPassword = await resetEmployeeLogin(id, ctx);
    return { ok: true, tempPassword };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

// --- activity log (admin only) --------------------------------------------

/** Fetch an older page of activity rows for the Log's infinite scroll. */
export async function loadActivityAction(offset: number): Promise<ActivityRow[]> {
  const role = await getRole();
  if (role.role !== 'admin') return [];
  const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  return getActivityPage(safeOffset, ACTIVITY_PAGE_SIZE);
}

/** Fetch the entire activity log for the .txt export. */
export async function exportActivityAction(): Promise<ActivityRow[]> {
  const role = await getRole();
  if (role.role !== 'admin') return [];
  return getAllActivity();
}

// --- admin management (master admin only) ---------------------------------

export async function createAdminAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireMasterAdmin();
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    if (!email) return { ok: false, error: 'Email is required' };
    if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
    await createAdmin(email, password, ctx);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  revalidatePath('/admins');
  return { ok: true };
}

export async function removeAdminAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireMasterAdmin();
    await removeAdmin(id, ctx);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  revalidatePath('/admins');
  return { ok: true };
}

// --- manual reordering (Custom sort) --------------------------------------

export async function reorderItemsAction(orderedIds: string[]): Promise<ActionResult> {
  try {
    await requireAdmin();
    await reorderItems(orderedIds);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

export async function reorderEmployeesAction(orderedIds: string[]): Promise<ActionResult> {
  try {
    await requireAdmin();
    await reorderEmployees(orderedIds);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

// --- items ----------------------------------------------------------------

export async function addItemAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
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
    const ctx = await requireAdmin();
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
    const ctx = await requireAdmin();
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
    const ctx = await requireAdmin();
    if (id) await softDeleteItem(id, ctx);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

export async function restoreItemAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    if (id) await restoreItem(id, ctx);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

/** Soft-delete many items at once (Select mode). Each is logged individually. */
export async function bulkDeleteItemsAction(ids: string[]): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    for (const id of ids) if (id) await softDeleteItem(id, ctx);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

/** Restore many soft-deleted items at once (Select mode). */
export async function bulkRestoreItemsAction(ids: string[]): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    for (const id of ids) if (id) await restoreItem(id, ctx);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

// --- branches / employees -------------------------------------------------

export async function createBranchAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return { ok: false, error: 'Branch name is required' };
    await createBranch(name, ctx);
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
    const ctx = await requireAdmin();
    const id = String(formData.get('id') ?? '');
    const name = String(formData.get('name') ?? '').trim();
    if (!id) return { ok: false, error: 'Missing branch id' };
    if (!name) return { ok: false, error: 'Branch name is required' };
    await updateBranch(
      id,
      { name, branchNo: String(formData.get('branch_no') ?? '').trim() || null },
      ctx,
    );
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

export async function deleteBranchAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    await deleteBranch(id, ctx);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

export async function setBranchHqAction(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
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
    await requireAdmin();
    await updateBranchPosition(id, x, y);
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

export async function createEmployeeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    const name = String(formData.get('name') ?? '').trim();
    const branchId = String(formData.get('branch_id') ?? '') || null;
    const email = String(formData.get('email') ?? '').trim() || null;
    if (!name) return { ok: false, error: 'Employee name is required' };
    const emp = await createEmployee(
      {
        name,
        branchId,
        phone: String(formData.get('phone') ?? '').trim() || null,
        position: String(formData.get('position') ?? '').trim() || null,
        status: (String(formData.get('status') ?? '') as EmployeeStatus) || undefined,
        email,
      },
      ctx,
    );
    // If an email was given, provision their read-only login and surface the temp password.
    if (email) {
      const tempPassword = await provisionEmployeeLogin(emp.id, email, ctx);
      return { ok: true, tempPassword };
    }
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}

export async function deleteEmployeeAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
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
    const ctx = await requireAdmin();
    const id = String(formData.get('id') ?? '');
    if (!id) return { ok: false, error: 'Missing employee id' };
    const branchRaw = formData.get('branch_id');
    await updateEmployee(
      id,
      {
        name: String(formData.get('name') ?? '').trim() || undefined,
        phone: formData.has('phone') ? String(formData.get('phone') ?? '').trim() || null : undefined,
        position: formData.has('position')
          ? String(formData.get('position') ?? '').trim() || null
          : undefined,
        status: (String(formData.get('status') ?? '') as EmployeeStatus) || undefined,
        branchId: branchRaw !== null ? String(branchRaw) || null : undefined,
      },
      ctx,
    );
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
  return { ok: true };
}
