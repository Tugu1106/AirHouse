import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadDataBundle } from '@/lib/data';

export const dynamic = 'force-dynamic';

// Client-side refresh endpoint. Called by the DataProvider after a write so the
// UI updates without a full page navigation.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bundle = await loadDataBundle();
  return NextResponse.json(bundle);
}
