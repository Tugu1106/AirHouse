import { redirect } from 'next/navigation';
import { getRole, isMasterEmail } from '@/lib/auth';
import { AppProviders } from '@/components/AppProviders';

// The admin area. Authorization is enforced here (server-side, with DB access):
// anonymous → /login, forced-reset → /set-password, workers → their own /me.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const r = await getRole();
  if (r.role === 'none') redirect('/login');
  if (r.user.must_reset) redirect('/set-password');
  if (r.role !== 'admin') redirect('/me');
  const isMaster = isMasterEmail(r.user.email);
  return <AppProviders isMaster={isMaster}>{children}</AppProviders>;
}
