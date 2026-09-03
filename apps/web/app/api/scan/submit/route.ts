import { NextResponse } from 'next/server';
import { setScanSpecs } from '@/lib/scanStore';

export const dynamic = 'force-dynamic';

const FIELDS = ['model', 'serial', 'system_name', 'cpu', 'ram', 'storage', 'os'];

// The employee's PC (the PowerShell script) POSTs its specs here, authenticated
// by the one-time token. No session — the script runs outside the browser.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';
  const rawSpecs = body?.specs && typeof body.specs === 'object' ? body.specs : null;
  const type = body?.type === 'laptop' ? 'laptop' : 'desktop';

  if (!token || !rawSpecs) {
    return NextResponse.json({ error: 'Missing token or specs.' }, { status: 400 });
  }

  const specs: Record<string, string> = {};
  for (const k of FIELDS) {
    const v = rawSpecs[k];
    if (v != null && String(v).trim() !== '') specs[k] = String(v).slice(0, 200);
  }

  if (!setScanSpecs(token, specs, type)) {
    return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, message: 'Sent to AirHouse — confirm it in your browser.' });
}
