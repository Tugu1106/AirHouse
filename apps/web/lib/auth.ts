import { createSupabaseServerClient } from './supabase/server';
import type { ActorContext } from '@airlink/core';

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
