// Seed (or reset) the admin login. Idempotent by email.
//   ADMIN_EMAIL=you@company.mn ADMIN_PASSWORD=secret pnpm exec tsx scripts/seed-admin.ts
process.env.DATABASE_URL ??= 'postgresql://airhouse:airhouse_dev@localhost:5432/airhouse';

import { seedAdmin } from '@airlink/core';

const email = process.env.ADMIN_EMAIL ?? process.argv[2];
const password = process.env.ADMIN_PASSWORD ?? process.argv[3];

async function main() {
  if (!email || !password) {
    console.error(
      'Usage: ADMIN_EMAIL=you@company.mn ADMIN_PASSWORD=secret pnpm exec tsx scripts/seed-admin.ts',
    );
    process.exit(1);
  }
  const result = await seedAdmin(email, password, { resetIfExists: true });
  console.log(`✓ Admin ${result}: ${email}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
