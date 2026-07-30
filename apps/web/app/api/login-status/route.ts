import { NextResponse } from 'next/server';
import { listLoginStatus } from '@airlink/core';
import { getRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Sign-in status per auth user (admin only) — powers the Employees "Login"
// column so you can see who has logged in vs. who was only invited.
export async function GET() {
  const role = await getRole();
  if (role.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const statuses = await listLoginStatus();
  return NextResponse.json(statuses);
}
