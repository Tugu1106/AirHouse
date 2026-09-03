import { NextResponse } from 'next/server';
import { getEmployee } from '@airlink/core';
import { getCurrentUser } from '@/lib/session';
import { createScan } from '@/lib/scanStore';

export const dynamic = 'force-dynamic';

// An employee starts registering their PC → returns a one-time token their
// machine will POST specs against.
export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.employee_id) {
    return NextResponse.json({ error: 'Only employees can register a PC.' }, { status: 403 });
  }
  const emp = await getEmployee(user.employee_id);
  if (!emp) return NextResponse.json({ error: 'Employee profile not found.' }, { status: 404 });

  const token = createScan({ employeeId: emp.id, actorId: user.id, branchId: emp.branch_id });
  return NextResponse.json({ token });
}
