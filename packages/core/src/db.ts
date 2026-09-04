// Server-only PostgreSQL access for all core business logic, via Kysely.
//
// Replaces the old Supabase client. Uses a plain connection string, so it runs
// anywhere Node runs (the web container, your machine, a future MCP container).
// Never import this into browser code.

import { Kysely, PostgresDialect, type Generated, type ColumnType } from 'kysely';
import { Pool, types } from 'pg';

// Return timestamptz as an ISO string (not a JS Date), so rows match the
// string-typed public models (created_at, updated_at, …) with no per-field
// conversion. 1184 = timestamptz.
types.setTypeParser(1184, (v: string) => new Date(v).toISOString());

/** Nullable column with no default — optional on insert. */
type Nullable<T> = ColumnType<T | null, T | null | undefined, T | null>;
/** jsonb column — object on read, JSON string on write. */
type Json<T> = ColumnType<T, string, string>;

interface BranchesTable {
  id: Generated<string>;
  name: string;
  map_x: Nullable<number>;
  map_y: Nullable<number>;
  is_hq: Generated<boolean>;
  branch_no: Nullable<string>;
  distance_hq: Nullable<string>;
  created_at: Generated<string>;
}

interface EmployeesTable {
  id: Generated<string>;
  name: string;
  branch_id: Nullable<string>;
  active: Generated<boolean>;
  phone: Nullable<string>;
  position: Nullable<string>;
  sector: Nullable<string>;
  status: Generated<string>;
  email: Nullable<string>;
  deleted_at: Nullable<string>;
  sort_order: Nullable<number>;
  created_at: Generated<string>;
}

interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  role: Generated<string>;
  employee_id: Nullable<string>;
  must_reset: Generated<boolean>;
  last_sign_in_at: Nullable<string>;
  created_at: Generated<string>;
}

interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  expires_at: string;
  created_at: Generated<string>;
  user_agent: Nullable<string>;
}

interface ItemsTable {
  id: Generated<string>;
  type: string;
  branch_id: string;
  assigned_to: Nullable<string>;
  properties: Json<Record<string, unknown>>;
  status: Generated<string>;
  deleted_at: Nullable<string>;
  sort_order: Nullable<number>;
  created_by: string;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

interface AuditLogTable {
  id: Generated<string>;
  entity_type: Generated<string>;
  entity_id: Nullable<string>;
  item_id: Nullable<string>;
  action: string;
  actor: string;
  from_branch_id: Nullable<string>;
  to_branch_id: Nullable<string>;
  from_employee_id: Nullable<string>;
  to_employee_id: Nullable<string>;
  diff: ColumnType<Record<string, unknown> | null, string | null, string | null>;
  created_at: Generated<string>;
}

export interface Database {
  branches: BranchesTable;
  employees: EmployeesTable;
  users: UsersTable;
  sessions: SessionsTable;
  items: ItemsTable;
  audit_log: AuditLogTable;
}

let cached: Kysely<Database> | null = null;

function make(connectionString: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString }) }),
  });
}

/**
 * Explicitly configure the core with a Postgres connection string. Use this in
 * runtimes that don't expose process.env; the web app doesn't need it, since
 * getDb() falls back to process.env.DATABASE_URL.
 */
export function configureCore(config: { connectionString: string }): void {
  cached = make(config.connectionString);
}

export function getDb(): Kysely<Database> {
  if (cached) return cached;
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const url = proc?.env?.DATABASE_URL;
  if (!url) {
    throw new Error(
      'Core is not configured. Set DATABASE_URL (Node) or call ' +
        'configureCore({ connectionString }) (other runtimes).',
    );
  }
  cached = make(url);
  return cached;
}
