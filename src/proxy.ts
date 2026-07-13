import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Next.js 16 Proxy (replaces the deprecated middleware convention).
 * 
 * Responsibilities:
 *  1. Refresh Supabase auth session cookies on every request
 *  2. Apply next-intl locale routing for non-auth pages
 *  3. Protect /dashboard routes — redirect unauthenticated users to /login
 *  4. Redirect authenticated users away from /login to /dashboard
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ─── Auth routes (OAuth callback, signout) ───
  // These are NOT under [locale] and should not be rewritten by intl
  if (pathname.startsWith('/auth/')) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            response = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    );

    // Refresh session — ensures cookies are up to date
    await supabase.auth.getUser();
    return response;
  }

  // ─── All other routes: Apply intl middleware first ───
  const response = intlMiddleware(request);

  // ─── Hook Supabase session refresh into the intl response ───
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // ─── Route protection ───
  const localePattern = routing.locales.join('|');
  const isDashboard = new RegExp(`^/(${localePattern})/dashboard`).test(pathname);
  const isLoginPage = new RegExp(`^/(${localePattern})/login$`).test(pathname);

  // Protect dashboard — unauthenticated users go to login
  if (!user && isDashboard) {
    const url = request.nextUrl.clone();
    const locale = pathname.split('/')[1] || 'en';
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from login page
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    const locale = pathname.split('/')[1] || 'en';
    url.pathname = `/${locale}/dashboard`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Match root
    '/',
    // Match all locale-prefixed paths
    '/(en|es|fr|de|it)/:path*',
    // Match all paths except static assets, API routes, and files with extensions
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // Match auth callback routes
    '/auth/:path*',
  ],
};
