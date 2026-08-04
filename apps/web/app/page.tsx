import { redirect } from 'next/navigation';
import { getRole } from '@/lib/auth';

// Entry point: route by role/state. Middleware already bounced anonymous users.
export default async function Home() {
  const r = await getRole();
  if (r.role === 'none') redirect('/login');
  if (r.user.must_reset) redirect('/set-password');
  redirect(r.role === 'admin' ? '/map' : '/me');
}
