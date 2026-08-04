-- ===========================================================================
-- 0002 — extend employees with phone, position, and a status lifecycle
-- ===========================================================================
-- Non-destructive: adds columns only. `status` replaces the coarse `active`
-- boolean for day-to-day use (active is kept for backward compatibility).
-- Status values are validated in packages/core (EMPLOYEE_STATUSES), not by a DB
-- constraint, so new statuses can be added without a migration.
-- ===========================================================================

alter table employees add column if not exists phone    text;
alter table employees add column if not exists position text;
alter table employees add column if not exists status   text not null default 'active';
