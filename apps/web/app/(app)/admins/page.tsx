import { redirect } from 'next/navigation';
import { listAdmins } from '@airlink/core';
import { getCurrentUser } from '@/lib/session';
import { isMasterEmail } from '@/lib/auth';
import { AdminsView } from '@/components/AdminsView';

export const dynamic = 'force-dynamic';

export default async function AdminsPage() {
  const me = await getCurrentUser();
  // Master-admin only. Level-2 admins that navigate here are bounced.
  if (!me || me.role !== 'admin' || !isMasterEmail(me.email)) redirect('/map');

  const admins = await listAdmins();
  return <AdminsView admins={admins} currentUserId={me.id} />;
}
