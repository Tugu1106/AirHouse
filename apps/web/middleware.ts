import { NextResponse, type NextRequest } from 'next/server';

// Coarse gate only (runs on the Edge, so no DB): send anonymous users to /login,
// and logged-in users away from /login. The real authorization — valid session,
// admin vs worker, forced password reset — happens in the server components and
// actions, which can reach Postgres.
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
  if (hasSession && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
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
