import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Refreshes the Supabase session cookie on every request and guards routes:
 * unauthenticated users are redirected to /login; logged-in users hitting
 * /login are sent to the dashboard.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Authenticate against the Supabase Auth server (not just the cookie). This is
  // the route gatekeeper, so the user/email/metadata it decides on must be
  // verified, not read from a possibly-stale or tampered cookie. getUser() makes
  // a network round-trip — the accepted tradeoff for a trustworthy auth check.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith('/login');
  const redirect = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = '';
    return NextResponse.redirect(url);
  };

  // Not logged in → only the login page is reachable.
  if (!user) {
    return isAuthRoute ? response : redirect('/login');
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? '').toLowerCase();
  // Fail-safe: until ADMIN_EMAIL is configured, every login is treated as admin
  // (so a deploy without it set can't lock the admin out). Worker gating turns
  // on only once ADMIN_EMAIL is set.
  const isAdmin = !adminEmail || user.email?.toLowerCase() === adminEmail;
  const mustReset = !!user.user_metadata?.must_reset;

  // Forced password change on first login (temp password).
  if (mustReset && path !== '/set-password') return redirect('/set-password');
  if (!mustReset && path === '/set-password') return redirect(isAdmin ? '/map' : '/me');

  if (isAdmin) {
    // Admin: full access; bounce off the login page.
    return isAuthRoute ? redirect('/map') : response;
  }

  // Worker: read-only, locked to their own profile.
  const workerAllowed = path === '/me' || path === '/set-password';
  if (!workerAllowed) return redirect('/me');
  return response;
}
