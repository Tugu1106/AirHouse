-- ===========================================================================
-- Seed data — run AFTER schema.sql / 0001_init.sql
-- ===========================================================================
-- Adjust branch names to your real branches. Khan Tower is included as an
-- example from the docs. Employees are optional starter rows.
-- ===========================================================================

insert into branches (name) values
  ('Khan Tower'),
  ('Branch 2'),
  ('Branch 3'),
  ('Branch 4'),
  ('Branch 5'),
  ('Branch 6')
on conflict do nothing;

-- Example employees (optional). Assign them to Khan Tower.
-- insert into employees (name, branch_id)
-- select 'John Doe', id from branches where name = 'Khan Tower';
