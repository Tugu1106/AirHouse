-- ===========================================================================
-- AirHouse — self-hosted PostgreSQL schema (no Supabase, custom auth)
-- ===========================================================================
-- Auth is owned by us now:
--   * users     — login identity (email + bcrypt hash, role, forced reset)
--   * sessions  — server-side sessions (opaque token; delete a row to revoke)
-- Employees hold the HR record; a worker's login is a users row linked by
-- employee_id. The admin is just a users row with role='admin' and no employee.
-- No Row Level Security — access control lives in application code.
-- ===========================================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- --- branches ---------------------------------------------------------------
create table if not exists branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  map_x       double precision,
  map_y       double precision,
  is_hq       boolean not null default false,
  branch_no   text,
  distance_hq text,
  created_at  timestamptz not null default now()
);

-- --- employees (HR record) --------------------------------------------------
create table if not exists employees (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  branch_id  uuid references branches(id),
  active     boolean not null default true,
  phone      text,
  position   text,
  sector     text,                 -- department/sector (fixed dropdown in the UI)
  status     text not null default 'active',
  email      text,                 -- work/contact email (login email for workers)
  deleted_at timestamptz,          -- soft-delete; kept so item history resolves names
  sort_order integer,              -- manual "Custom" order within a branch (nulls last)
  created_at timestamptz not null default now()
);
create index if not exists employees_branch_id_idx on employees(branch_id);
create unique index if not exists employees_email_unique
  on employees (lower(email)) where email is not null;

-- --- users (auth identity) --------------------------------------------------
create table if not exists users (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  password_hash   text not null,
  role            text not null default 'worker' check (role in ('admin', 'worker')),
  employee_id     uuid references employees(id) on delete cascade,  -- null for admin
  must_reset      boolean not null default true,   -- on temp password until first change
  last_sign_in_at timestamptz,
  created_at      timestamptz not null default now()
);
create unique index if not exists users_email_unique on users (lower(email));
create unique index if not exists users_employee_id_unique
  on users (employee_id) where employee_id is not null;

-- --- sessions (server-side; revocable) --------------------------------------
create table if not exists sessions (
  id         uuid primary key default gen_random_uuid(),  -- the cookie token
  user_id    uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  user_agent text
);
create index if not exists sessions_user_id_idx    on sessions(user_id);
create index if not exists sessions_expires_at_idx on sessions(expires_at);

-- --- items ------------------------------------------------------------------
create table if not exists items (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  branch_id   uuid not null references branches(id),
  assigned_to uuid references employees(id),
  properties  jsonb not null default '{}'::jsonb,
  status      text not null default 'active',
  deleted_at  timestamptz,
  sort_order  integer,             -- manual "Custom" order within a branch (nulls last)
  created_by  uuid not null,       -- users.id of the actor (no FK: audit must survive)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists items_branch_id_idx   on items(branch_id);
create index if not exists items_assigned_to_idx on items(assigned_to);
create index if not exists items_type_idx        on items(type);
create index if not exists items_status_idx      on items(status);
create index if not exists items_deleted_at_idx  on items(deleted_at);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists items_set_updated_at on items;
create trigger items_set_updated_at
  before update on items
  for each row execute function set_updated_at();

-- --- audit_log --------------------------------------------------------------
create table if not exists audit_log (
  id               uuid primary key default gen_random_uuid(),
  entity_type      text not null default 'item',   -- 'item' | 'employee' | 'branch'
  entity_id        uuid,                            -- id of the affected entity
  item_id          uuid references items(id),       -- set for item entities (item history)
  action           text not null,
  actor            uuid not null,   -- users.id (no FK: history must survive deletes)
  from_branch_id   uuid references branches(id),
  to_branch_id     uuid references branches(id),
  from_employee_id uuid references employees(id),
  to_employee_id   uuid references employees(id),
  diff             jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists audit_log_item_id_idx    on audit_log(item_id);
create index if not exists audit_log_created_at_idx on audit_log(created_at desc);
