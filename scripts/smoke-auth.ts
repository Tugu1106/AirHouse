// Stage 3 smoke test — exercises custom auth (bcrypt, sessions, provisioning)
// against the local dev Postgres. Run: pnpm exec tsx scripts/smoke-auth.ts
process.env.DATABASE_URL ??= 'postgresql://airhouse:airhouse_dev@localhost:5432/airhouse';

import {
  seedAdmin,
  verifyCredentials,
  createSession,
  getSessionUser,
  deleteSession,
  setUserPassword,
  createBranch,
  createEmployee,
  provisionEmployeeLogin,
  resetEmployeeLogin,
  listLoginStatus,
  getEmployee,
} from '@airlink/core';

const ok = (label: string, cond: boolean) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) throw new Error(`assertion failed: ${label}`);
};

async function main() {
  const stamp = Date.now();
  const adminEmail = `admin${stamp}@airlink.mn`;
  const workerEmail = `worker${stamp}@airlink.mn`;

  // --- admin ---
  await seedAdmin(adminEmail, 'admin-pass-123');
  ok('wrong password rejected', (await verifyCredentials(adminEmail, 'nope')) === null);
  const admin = await verifyCredentials(adminEmail, 'admin-pass-123');
  ok('admin verifies (role admin, must_reset false)', admin?.role === 'admin' && admin.must_reset === false);

  // --- sessions ---
  const session = await createSession(admin!.id);
  ok('session resolves back to the user', (await getSessionUser(session.id))?.id === admin!.id);
  ok('malformed session id → null (no crash)', (await getSessionUser('not-a-uuid')) === null);
  await deleteSession(session.id);
  ok('revoked session no longer resolves', (await getSessionUser(session.id)) === null);

  // --- worker provisioning ---
  const branch = await createBranch(`AuthBr ${stamp}`);
  const emp = await createEmployee({ name: 'Auth Worker', branchId: branch.id });
  const temp = await provisionEmployeeLogin(emp.id, workerEmail);
  ok('provision returns a temp password', typeof temp === 'string' && temp.length >= 8);

  const worker = await verifyCredentials(workerEmail, temp);
  ok(
    'worker verifies with temp (role worker, must_reset true, linked)',
    worker?.role === 'worker' && worker.must_reset === true && worker.employee_id === emp.id,
  );

  // --- worker sets own password ---
  await setUserPassword(worker!.id, 'my-own-pass-456');
  ok('new password works, must_reset cleared', (await verifyCredentials(workerEmail, 'my-own-pass-456'))?.must_reset === false);
  ok('old temp password no longer works', (await verifyCredentials(workerEmail, temp)) === null);

  // --- employee.user_id + login status ---
  ok('getEmployee populates user_id from the join', (await getEmployee(emp.id))?.user_id === worker!.id);
  const status = await listLoginStatus();
  ok('listLoginStatus keyed by user_id, signedIn=true', status[worker!.id]?.signedIn === true);

  // --- reset + duplicate guard ---
  const temp2 = await resetEmployeeLogin(emp.id);
  ok('reset issues new temp (must_reset true again)', (await verifyCredentials(workerEmail, temp2))?.must_reset === true);
  let dupThrew = false;
  try {
    await provisionEmployeeLogin(emp.id, workerEmail);
  } catch {
    dupThrew = true;
  }
  ok('provisioning a duplicate email throws', dupThrew);

  console.log('\nAUTH SMOKE OK ✅');
  process.exit(0);
}

main().catch((e) => {
  console.error('\nAUTH SMOKE FAIL ❌\n', e);
  process.exit(1);
});
