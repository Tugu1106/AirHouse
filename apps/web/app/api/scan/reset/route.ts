import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getScan, clearScanSpecs } from '@/lib/scanStore';

export const dynamic = 'force-dynamic';

// Employee asked to re-scan: drop the stored specs (keep the token) so the
// browser waits for the freshly-run scanner instead of the previous result.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.employee_id) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';
  const scan = getScan(token);
  if (!scan || scan.employeeId !== user.employee_id) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  clearScanSpecs(token);
  return NextResponse.json({ ok: true });
}
