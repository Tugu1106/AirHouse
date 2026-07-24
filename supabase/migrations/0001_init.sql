-- ===========================================================================
-- Airlink IT Asset Tracker — initial schema (Phase 1)
-- ===========================================================================
-- Design notes:
--   * Every business table carries branch_id + created_by from day one so that
--     worker accounts + Row Level Security can be added later WITHOUT a schema
--     change (see docs section 2.3). RLS is intentionally NOT enabled in v1.
--   * items.properties is JSONB so new item types need no migration — the
--     field set for each type lives in packages/core (itemTypes registry).
--   * Nothing is ever hard-deleted: items use deleted_at (soft delete) and all
--     mutations are recorded append-only in audit_log.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- branches
-- ---------------------------------------------------------------------------
create table if not exists branches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------
create table if not exists employees (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  branch_id  uuid references branches(id),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists employees_branch_id_idx on employees(branch_id);

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------
create table if not exists items (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,                        -- 'pc', 'cable', 'monitor', ...
  branch_id   uuid not null references branches(id),
  assigned_to uuid references employees(id),
  properties  jsonb not null default '{}'::jsonb,   -- type-specific fields
  status      text not null default 'active',       -- 'active','in_repair','retired','lost'
  deleted_at  timestamptz,                          -- soft-delete marker; null = live
  created_by  uuid not null,                        -- acting user/admin (auth.users.id)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists items_branch_id_idx   on items(branch_id);
create index if not exists items_assigned_to_idx on items(assigned_to);
create index if not exists items_type_idx        on items(type);
create index if not exists items_status_idx      on items(status);
create index if not exists items_deleted_at_idx  on items(deleted_at);

-- keep updated_at fresh on every UPDATE
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

-- ---------------------------------------------------------------------------
-- audit_log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id               uuid primary key default gen_random_uuid(),
  item_id          uuid not null references items(id),
  action           text not null,                   -- 'create','update','soft_delete','transfer'
  actor            uuid not null,
  from_branch_id   uuid references branches(id),
  to_branch_id     uuid references branches(id),
  from_employee_id uuid references employees(id),
  to_employee_id   uuid references employees(id),
  diff             jsonb,                            -- optional: what changed
  created_at       timestamptz not null default now()
);

create index if not exists audit_log_item_id_idx    on audit_log(item_id);
create index if not exists audit_log_created_at_idx on audit_log(created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- RLS is ENABLED with NO policies. This is a deliberate deny-all posture for
-- v1: the app talks to the DB exclusively through the service_role key (see
-- packages/core), which BYPASSES RLS, so everything keeps working — while the
-- public anon key (exposed in the browser for the login flow) is denied all
-- direct table access via the REST API.
--
-- When worker accounts arrive (phase 3), just ADD policies scoped by branch_id
-- on top of this. No schema change required at that point.
-- ---------------------------------------------------------------------------
alter table branches  enable row level security;
alter table employees enable row level security;
alter table items     enable row level security;
alter table audit_log enable row level security;
