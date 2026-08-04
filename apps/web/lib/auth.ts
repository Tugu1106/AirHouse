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
