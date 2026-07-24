import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadDataBundle } from '@/lib/data';

export const dynamic = 'force-dynamic';

// Client-side refresh endpoint. Called by the DataProvider after a write so the
// UI updates without a full page navigation.
export async function GET() {
  // Cookie-based session check (no network) — the middleware already gates
  // access to authenticated users, this is just defense-in-depth.
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bundle = await loadDataBundle();
  return NextResponse.json(bundle);
}
