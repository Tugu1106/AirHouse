import { createSupabaseServerClient } from './supabase/server';
import { findEmployeeByEmail, type ActorContext, type Employee } from '@airlink/core';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? '').toLowerCase();

export type Role =
  | { role: 'admin'; email: string }
  | { role: 'worker'; email: string; employee: Employee }
  | { role: 'none' };

/** Determine the current user's role: the configured admin, a matched employee
 *  (worker), or none. Used to gate admin vs read-only worker access. */
export async function getRole(): Promise<Role> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return { role: 'none' };
  // Fail-safe: no ADMIN_EMAIL configured → treat any login as admin.
  if (!ADMIN_EMAIL || email === ADMIN_EMAIL) return { role: 'admin', email };
  const employee = await findEmployeeByEmail(email);
  if (employee) return { role: 'worker', email, employee };
  return { role: 'none' };
}

/**
 * Returns the current admin user's id as an ActorContext for core calls, or
 * throws if there is no session (should not happen behind the middleware
 * guard, but keeps mutations honest).
 */
export async function requireActor(): Promise<ActorContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { actorId: user.id };
}

export async function getCurrentUserEmail(): Promise<string | null> {
  // Read the email from the session cookie (no network round-trip) — this is on
  // the initial-load hot path and it's only used to display the address.
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.email ?? null;
}
