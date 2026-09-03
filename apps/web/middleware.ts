import { NextResponse, type NextRequest } from 'next/server';

// Coarse gate only (runs on the Edge, so no DB): send anonymous users to /login.
// The real authorization — valid session, admin vs worker, forced password reset,
// and routing a logged-in user to their dashboard — happens in the server
// components/actions, which can reach Postgres. We deliberately do NOT bounce
// cookie-holders away from /login here: the cookie may be stale (its session row
// already deleted), and blocking /login on a mere cookie both traps such users in
// a /login → / → /login redirect loop and prevents switching accounts.
// /scan is the public asset-tag lookup a QR opens — no login (any phone on the
// internal network can view an item's live owner/branch/status).
const PUBLIC = ['/login', '/scan'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has('session');
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except API routes (they return 403 themselves) and static assets.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
