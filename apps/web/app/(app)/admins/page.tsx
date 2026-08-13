import { listAdmins } from '@airlink/core';
import { getCurrentUser } from '@/lib/session';
import { AdminsView } from '@/components/AdminsView';

export const dynamic = 'force-dynamic';

export default async function AdminsPage() {
  const [admins, me] = await Promise.all([listAdmins(), getCurrentUser()]);
  return <AdminsView admins={admins} currentUserId={me?.id ?? null} />;
}
