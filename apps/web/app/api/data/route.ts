import { NextResponse } from 'next/server';
import { getRole } from '@/lib/auth';
import { loadDataBundle } from '@/lib/data';

export const dynamic = 'force-dynamic';

// The full data bundle — admin only. Workers never load it (they have their own
// scoped profile page); this is defense-in-depth.
export async function GET() {
  const role = await getRole();
  if (role.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const bundle = await loadDataBundle();
  return NextResponse.json(bundle);
}
