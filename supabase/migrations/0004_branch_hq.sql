-- ===========================================================================
-- 0004 — mark one branch as the central/HQ branch
-- ===========================================================================
-- A single branch can be the "center" (shown centrally in the node map and
-- badged in both map views). Enforced in app logic (setting one unsets others).
-- ===========================================================================

alter table branches add column if not exists is_hq boolean not null default false;
