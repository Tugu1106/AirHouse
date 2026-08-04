// Stage 2 smoke test — exercises the rewritten (Kysely/pg) core data layer
// against the local dev Postgres. Run: pnpm exec tsx scripts/smoke-core.ts
process.env.DATABASE_URL ??= 'postgresql://airhouse:airhouse_dev@localhost:5432/airhouse';

import {
  createBranch,
  createEmployee,
  addItem,
  listItems,
  getItemWithRelations,
  transferItem,
  listAuditForItem,
  deleteEmployee,
  listEmployees,
  listLoginStatus,
  branchItemCounts,
} from '@airlink/core';

const ACTOR = '00000000-0000-0000-0000-000000000001'; // stand-in users.id
const ok = (label: string, cond: boolean) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) throw new Error(`assertion failed: ${label}`);
};

async function main() {
  const stamp = Date.now();
  const branch = await createBranch(`Smoke ${stamp}`);
  ok('createBranch returns id + ISO created_at', !!branch.id && typeof branch.created_at === 'string');

  const emp = await createEmployee({
    name: 'Smoke Emp',
    branchId: branch.id,
    email: `smoke${stamp}@airlink.mn`,
    position: 'Developer',
  });
  ok('createEmployee links branch', emp.branch_id === branch.id);

  const item = await addItem(
    {
      type: 'desktop',
      branch_id: branch.id,
      assigned_to: emp.id,
      properties: { model: 'OptiPlex', system_name: 'SMK-1', cpu: 'i7', ram: '16GB' },
    },
    { actorId: ACTOR },
  );
  ok('addItem stores jsonb properties', (item.properties as { model?: string }).model === 'OptiPlex');

  const rel = await getItemWithRelations(item.id);
  ok('joined branch name', rel?.branch?.name === branch.name);
  ok('joined assignee name', rel?.assignee?.name === 'Smoke Emp');

  const listed = await listItems({ branchId: branch.id });
  ok('listItems finds the item', listed.some((r) => r.id === item.id));

  await transferItem(item.id, { toEmployeeId: null, reason: 'employee_deleted' }, { actorId: ACTOR });
  const audit = await listAuditForItem(item.id);
  ok('audit has create + transfer (newest first)', audit[0]?.action === 'transfer' && audit.at(-1)?.action === 'create');
  ok('transfer diff carries reason', (audit[0]?.diff as { reason?: string } | null)?.reason === 'employee_deleted');

  const counts = await branchItemCounts();
  ok('branchItemCounts includes branch', (counts[branch.id] ?? 0) >= 1);

  await deleteEmployee(emp.id, { actorId: ACTOR });
  const live = await listEmployees(branch.id);
  ok('deleted employee excluded from live list', !live.some((e) => e.id === emp.id));

  const status = await listLoginStatus();
  ok('listLoginStatus returns a map', typeof status === 'object');

  console.log('\nSMOKE OK ✅');
  process.exit(0);
}

main().catch((e) => {
  console.error('\nSMOKE FAIL ❌\n', e);
  process.exit(1);
});
