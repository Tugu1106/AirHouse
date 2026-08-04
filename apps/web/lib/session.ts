import { cookies } from 'next/headers';
import { getSessionUser, type AuthUser } from '@airlink/core';

const COOKIE = 'session';

export async function setSessionCookie(id: string, expiresAt: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    // Only mark Secure when actually served over HTTPS — a Secure cookie is
    // never sent over plain HTTP, which would log the user out on every request.
    // The internal server is HTTP behind Nginx; set COOKIE_SECURE=true if you
    // later add TLS.
    secure: process.env.COOKIE_SECURE === 'true',
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
