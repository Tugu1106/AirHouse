import { NextResponse } from 'next/server';
import { addItem, listItems } from '@airlink/core';
import { getCurrentUser } from '@/lib/session';
import { getScan, deleteScan } from '@/lib/scanStore';

export const dynamic = 'force-dynamic';

// The employee reviewed the scanned specs and confirmed → create the item,
// assigned to them, in their branch, marked as a self-registration (via 'scan').
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.employee_id) {
    return NextResponse.json({ ok: false, message: 'Not authorized.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';
  const scan = getScan(token);
  if (!scan || scan.employeeId !== user.employee_id || !scan.specs) {
    return NextResponse.json({ ok: false, message: 'Scan not found or expired.' }, { status: 400 });
  }
  if (!scan.branchId) {
    return NextResponse.json(
      { ok: false, message: 'Your profile has no branch yet — ask an admin to set it, then try again.' },
      { status: 400 },
    );
  }

  // Don't create a duplicate if this serial is already registered.
  const serial = scan.specs.serial;
  if (serial) {
    const existing = await listItems({ search: serial });
    const match = existing.find(
      (i) => String(i.properties?.serial ?? '').toLowerCase() === serial.toLowerCase(),
    );
    if (match) {
      deleteScan(token);
      return NextResponse.json({
        ok: false,
        message: 'This PC (same serial) is already registered.',
        itemId: match.id,
      });
    }
  }

  const item = await addItem(
    {
      type: scan.itemType || 'desktop',
      branch_id: scan.branchId,
      assigned_to: scan.employeeId,
      status: 'active',
      properties: scan.specs,
    },
    { actorId: scan.actorId, via: 'scan' },
  );
  deleteScan(token);
  return NextResponse.json({ ok: true, itemId: item.id });
}
