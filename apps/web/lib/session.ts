import { cookies } from 'next/headers';
import { getSessionUser, type AuthUser } from '@airlink/core';

const COOKIE = 'session';

export async function setSessionCookie(id: string, expiresAt: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/** The current authenticated user (verified against the sessions table), or null. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const id = await getSessionId();
  if (!id) return null;
  return getSessionUser(id);
}
