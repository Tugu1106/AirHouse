// Plain-JS admin seed for the server (run in a throwaway node container by the
// deploy script — no monorepo/TS needed). Create-only: never clobbers an
// existing admin. Env: DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD.
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.log('seed: DATABASE_URL / ADMIN_EMAIL / ADMIN_PASSWORD not all set — skipping');
  process.exit(0);
}

const pool = new Pool({ connectionString: DATABASE_URL });
try {
  const { rows } = await pool.query('select id from users where lower(email) = lower($1)', [
    ADMIN_EMAIL,
  ]);
  if (rows.length > 0) {
    console.log(`seed: admin already exists (${ADMIN_EMAIL})`);
  } else {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await pool.query(
      "insert into users (email, password_hash, role, must_reset) values ($1, $2, 'admin', false)",
      [ADMIN_EMAIL, hash],
    );
    console.log(`seed: admin created (${ADMIN_EMAIL})`);
  }
} finally {
  await pool.end();
}
