-- ===========================================================================
-- 0007 — soft-delete employees (keep the row for item history)
-- ===========================================================================
-- A deleted employee is hidden from active lists but the row stays so audit_log
-- (who owned an item, and when) still resolves their name.
-- ===========================================================================

alter table employees add column if not exists deleted_at timestamptz;
