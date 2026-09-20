import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);

  const redirectWithCookies = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    redirect.headers.set('Content-Security-Policy', csp);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          const previousCookies = response.cookies.getAll();
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          response.headers.set('Content-Security-Policy', csp);
          previousCookies.forEach(cookie => response.cookies.set(cookie));
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          const previousCookies = response.cookies.getAll();
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          response.headers.set('Content-Security-Policy', csp);
          previousCookies.forEach(cookie => response.cookies.set(cookie));
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Use getUser() instead of getSession() — it validates the JWT server-side
  // and also triggers a token refresh if needed, writing new cookies to the response.
  const { data: { user } } = await supabase.auth.getUser();

  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard');
  const isRoot = request.nextUrl.pathname === '/';

  // Redirect unauthenticated users away from dashboard
  if (!user && isDashboard) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    return redirectWithCookies(redirectUrl);
  }

  if (user && (request.nextUrl.pathname === '/dashboard/admin' || request.nextUrl.pathname.startsWith('/dashboard/admin/'))) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/dashboard';
      return redirectWithCookies(redirectUrl);
    }
  }

  // Redirect authenticated users away from login (but allow /register)
  if (user && isRoot) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return redirectWithCookies(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/', '/register', '/dashboard/:path*', '/certificate/:path*'],
};
