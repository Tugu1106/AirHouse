-- ===========================================================================
-- 0006 — employee self-service login
-- ===========================================================================
-- email links an employee to their auth login; user_id stores the created
-- Supabase Auth user id (set when their login is provisioned).
-- ===========================================================================

alter table employees add column if not exists email   text;
alter table employees add column if not exists user_id uuid;

create unique index if not exists employees_email_unique
  on employees (lower(email)) where email is not null;
