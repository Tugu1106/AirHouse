-- ===========================================================================
-- 0003 — store each branch's position on the custom city-map view
-- ===========================================================================
-- map_x / map_y are fractions (0..1) of the map image's width/height, so they
-- stay correct regardless of the image's display size. Null = not placed yet.
-- ===========================================================================

alter table branches add column if not exists map_x double precision;
alter table branches add column if not exists map_y double precision;
