-- ===========================================================================
-- Airlink IT Asset Tracker — full schema snapshot (Phase 1)
-- ===========================================================================
-- Self-contained snapshot of the current schema. Source of truth is the
-- ordered files in supabase/migrations/. To set up a fresh database, paste
-- THIS file into the Supabase SQL editor and run it (it is equivalent to
-- migrations/0001_init.sql).
-- ===========================================================================

create extension if not exists "pgcrypto";

create table if not exists branches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  map_x       double precision,
  map_y       double precision,
  is_hq       boolean not null default false,
  branch_no   text,
  distance_hq text,
  created_at  timestamptz not null default now()
);

create table if not exists employees (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  branch_id  uuid references branches(id),
  active     boolean not null default true,
  phone      text,
  position   text,
  status     text not null default 'active',
  created_at timestamptz not null default now()
);
create index if not exists employees_branch_id_idx on employees(branch_id);

create table if not exists items (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  branch_id   uuid not null references branches(id),
  assigned_to uuid references employees(id),
  properties  jsonb not null default '{}'::jsonb,
  status      text not null default 'active',
  deleted_at  timestamptz,
  created_by  uuid not null,
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

create table if not exists audit_log (
  id               uuid primary key default gen_random_uuid(),
  item_id          uuid not null references items(id),
  action           text not null,
  actor            uuid not null,
  from_branch_id   uuid references branches(id),
  to_branch_id     uuid references branches(id),
  from_employee_id uuid references employees(id),
  to_employee_id   uuid references employees(id),
  diff             jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists audit_log_item_id_idx    on audit_log(item_id);
create index if not exists audit_log_created_at_idx on audit_log(created_at desc);

-- Row Level Security: ENABLED with no policies (deny-all to anon/authenticated).
-- The app uses the service_role key, which bypasses RLS, so it keeps working.
-- Add branch-scoped policies later (phase 3) when worker accounts exist.
alter table branches  enable row level security;
alter table employees enable row level security;
alter table items     enable row level security;
alter table audit_log enable row level security;
