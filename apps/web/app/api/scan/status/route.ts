import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getScan } from '@/lib/scanStore';

export const dynamic = 'force-dynamic';

// The browser polls this while waiting for the PC to send its specs.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ready: false }, { status: 403 });

  const token = new URL(req.url).searchParams.get('token') ?? '';
  const scan = getScan(token);
  if (!scan || scan.employeeId !== user.employee_id) {
    return NextResponse.json({ ready: false });
  }
  return NextResponse.json({
    ready: !!scan.specs,
    specs: scan.specs ?? null,
    type: scan.itemType ?? null,
  });
}
