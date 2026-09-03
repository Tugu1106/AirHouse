import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { WRITE_TOOL_NAMES, runWriteTool } from '@/lib/ai';

export const dynamic = 'force-dynamic';

// Runs a write the AI proposed, AFTER the admin confirmed it in the chat.
// Admin-gated and attributed to the admin (audit-logged like any manual action).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admins only.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const tool = typeof body?.tool === 'string' ? body.tool : '';
  const args = body?.args && typeof body.args === 'object' ? body.args : {};

  if (!WRITE_TOOL_NAMES.has(tool)) {
    return NextResponse.json({ ok: false, message: 'Not a valid action.' }, { status: 400 });
  }

  const result = await runWriteTool(tool, args, { actorId: user.id, via: 'ai' });
  return NextResponse.json(result);
}
