import { getEmployee, type ActorContext, type AuthUser, type Employee } from '@airlink/core';
import { getCurrentUser } from './session';

export type Role =
  | { role: 'admin'; user: AuthUser }
  | { role: 'worker'; user: AuthUser; employee: Employee }
  | { role: 'none' };

/** Determine the current user's role from their session: admin, worker (with
 *  their employee record), or none. Used to gate admin vs read-only access. */
export async function getRole(): Promise<Role> {
  const user = await getCurrentUser();
  if (!user) return { role: 'none' };
  if (user.role === 'admin') return { role: 'admin', user };
  const employee = user.employee_id ? await getEmployee(user.employee_id) : null;
  if (!employee) return { role: 'none' };
  return { role: 'worker', user, employee };
}

/**
 * Returns the current user's id as an ActorContext for core writes, or throws
 * if there is no valid session (should not happen behind the guards).
 */
export async function requireActor(): Promise<ActorContext> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  return { actorId: user.id };
}

export async function getCurrentUserEmail(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.email ?? null;
}

// --- master admin ----------------------------------------------------------
// One designated account (by email) may manage other admins. Everyone else with
// role='admin' is a level-2 admin: full access except the Admins page/actions.
// Defaults to the seeded admin (ADMIN_EMAIL), overridable via MASTER_ADMIN_EMAIL.
const MASTER_ADMIN_EMAIL = (
  process.env.MASTER_ADMIN_EMAIL ??
  process.env.ADMIN_EMAIL ??
  'admin@airlink.mn'
).toLowerCase();

export function isMasterEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === MASTER_ADMIN_EMAIL;
}

/** True only for the master admin's session. */
export async function isMasterAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user && user.role === 'admin' && isMasterEmail(user.email);
}

/** Actor context for the master admin, or throw. Guards admin-management. */
export async function requireMasterAdmin(): Promise<ActorContext> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin' || !isMasterEmail(user.email)) {
    throw new Error('Only the master admin can manage admins.');
  }
  return { actorId: user.id };
}
