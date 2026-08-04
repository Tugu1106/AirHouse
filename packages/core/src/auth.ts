// Custom auth — owned by us, no third-party auth service.
//   * bcrypt password hashing
//   * server-side sessions (a row per login; delete to revoke)
//   * worker login provisioning + admin seeding
// Runs server-side only (needs the DB). Never import into browser/Edge code.

import bcrypt from 'bcryptjs';
import { getDb } from './db';
import type { UUID } from './types';

const SALT_ROUNDS = 10;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type UserRole = 'admin' | 'worker';

export interface AuthUser {
  id: UUID;
  email: string;
  role: UserRole;
  employee_id: UUID | null;
  must_reset: boolean;
}

const hashPassword = (pw: string): Promise<string> => bcrypt.hash(pw, SALT_ROUNDS);

/** Readable one-time password (no look-alike characters), 10 chars. */
export function genTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';
  const bytes = new Uint8Array(10);
  (globalThis as unknown as { crypto: { getRandomValues: (a: Uint8Array) => void } }).crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]!).join('');
}

/** Verify email + password. On success, bumps last_sign_in_at and returns the user. */
export async function verifyCredentials(email: string, password: string): Promise<AuthUser | null> {
  const db = getDb();
  const row = await db
    .selectFrom('users')
    .selectAll()
    .where('email', 'ilike', email.trim())
    .executeTakeFirst();
  if (!row) return null;
  if (!(await bcrypt.compare(password, row.password_hash))) return null;
  await db
    .updateTable('users')
    .set({ last_sign_in_at: new Date().toISOString() })
    .where('id', '=', row.id)
    .execute();
  return {
    id: row.id,
    email: row.email,
    role: row.role as UserRole,
    employee_id: row.employee_id,
    must_reset: row.must_reset,
  };
}

/** Create a server-side session; returns the token (cookie value) + expiry. */
export async function createSession(
  userId: UUID,
  userAgent?: string | null,
): Promise<{ id: string; expiresAt: string }> {
  const db = getDb();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const row = await db
    .insertInto('sessions')
    .values({ user_id: userId, expires_at: expiresAt, user_agent: userAgent ?? null })
    .returning(['id', 'expires_at'])
    .executeTakeFirstOrThrow();
  return { id: row.id, expiresAt: row.expires_at };
}

/** Resolve the user for a session token, or null if missing/expired (expired is deleted). */
export async function getSessionUser(sessionId: string): Promise<AuthUser | null> {
  if (!UUID_RE.test(sessionId)) return null; // malformed cookie → not a valid session
  const db = getDb();
  const row = await db
    .selectFrom('sessions as s')
    .innerJoin('users as u', 'u.id', 's.user_id')
    .select([
      'u.id as id',
      'u.email as email',
      'u.role as role',
      'u.employee_id as employee_id',
      'u.must_reset as must_reset',
      's.expires_at as expires_at',
    ])
    .where('s.id', '=', sessionId)
    .executeTakeFirst();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await deleteSession(sessionId);
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    role: row.role as UserRole,
    employee_id: row.employee_id,
    must_reset: row.must_reset,
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (!UUID_RE.test(sessionId)) return;
  await getDb().deleteFrom('sessions').where('id', '=', sessionId).execute();
}

/** The id of an admin user (oldest), for tools that act as the admin (MCP). */
export async function getAdminActorId(): Promise<string | null> {
  const row = await getDb()
    .selectFrom('users')
    .select('id')
    .where('role', '=', 'admin')
    .orderBy('created_at')
    .executeTakeFirst();
  return row?.id ?? null;
}

/** Set a user's own password and clear the forced-reset flag. */
export async function setUserPassword(userId: UUID, newPassword: string): Promise<void> {
  await getDb()
    .updateTable('users')
    .set({ password_hash: await hashPassword(newPassword), must_reset: false })
    .where('id', '=', userId)
    .execute();
}

/**
 * Create a read-only worker login: a users row with a one-time temp password
 * (forced change on first sign-in). Returns the temp password to share. Throws
 * if a login for that email already exists.
 */
export async function provisionEmployeeLogin(employeeId: UUID, email: string): Promise<string> {
  const db = getDb();
  const e = email.trim();
  const existing = await db.selectFrom('users').select('id').where('email', 'ilike', e).executeTakeFirst();
  if (existing) {
    throw new Error('A login for this email already exists. Use "reset password" instead.');
  }
  const temp = genTempPassword();
  await db
    .insertInto('users')
    .values({
      email: e,
      password_hash: await hashPassword(temp),
      role: 'worker',
      employee_id: employeeId,
      must_reset: true,
    })
    .execute();
  await db.updateTable('employees').set({ email: e }).where('id', '=', employeeId).execute();
  return temp;
}

/** Reset an existing worker login to a new temp password (forces re-change). */
export async function resetEmployeeLogin(employeeId: UUID): Promise<string> {
  const db = getDb();
  const user = await db
    .selectFrom('users')
    .select('id')
    .where('employee_id', '=', employeeId)
    .executeTakeFirst();
  if (!user) throw new Error('This employee has no login yet. Create one first.');
  const temp = genTempPassword();
  await db
    .updateTable('users')
    .set({ password_hash: await hashPassword(temp), must_reset: true })
    .where('id', '=', user.id)
    .execute();
  return temp;
}

/**
 * Ensure an admin login exists. By default create-only (never clobbers an
 * existing admin whose password may have been changed) — used by startup
 * auto-seed. Pass resetIfExists to intentionally reset the password.
 */
export async function seedAdmin(
  email: string,
  password: string,
  opts?: { resetIfExists?: boolean },
): Promise<'created' | 'updated' | 'exists'> {
  const db = getDb();
  const e = email.trim();
  const existing = await db.selectFrom('users').select('id').where('email', 'ilike', e).executeTakeFirst();
  if (existing) {
    if (!opts?.resetIfExists) return 'exists';
    await db
      .updateTable('users')
      .set({ password_hash: await hashPassword(password), role: 'admin', must_reset: false })
      .where('id', '=', existing.id)
      .execute();
    return 'updated';
  }
  await db
    .insertInto('users')
    .values({
      email: e,
      password_hash: await hashPassword(password),
      role: 'admin',
      must_reset: false,
      employee_id: null,
    })
    .execute();
  return 'created';
}
