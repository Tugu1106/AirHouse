-- ===========================================================================
-- 0005 — custom branch info fields
-- ===========================================================================
-- Free-text so the admin can enter whatever fits (e.g. "B-07", "3.5 km").
-- ===========================================================================

alter table branches add column if not exists branch_no   text;
alter table branches add column if not exists distance_hq text;
